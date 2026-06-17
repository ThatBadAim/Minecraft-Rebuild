# Zero-Dependency PowerShell Web Server for hosting Minecraft Clone locally.
# This avoids CORS errors with ES6 modules in the browser.

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Minecraft Web Clone Server Started!" -ForegroundColor Green
    Write-Host "  Open your browser and navigate to:" -ForegroundColor Cyan
    Write-Host "  http://localhost:$port/" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Press Ctrl+C in this terminal window to stop the server." -ForegroundColor White
    Write-Host ""
} catch {
    Write-Error "Failed to start listener: $_"
    exit
}

# Simple helper to get MIME type
function Get-MimeType($extension) {
    switch ($extension) {
        ".html" { return "text/html" }
        ".css"  { return "text/css" }
        ".js"   { return "application/javascript" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Determine requested file
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/log") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $body | Out-File -FilePath "$PSScriptRoot\test_results.txt" -Encoding utf8

            $response.StatusCode = 200
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes("OK")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        # Local file path
        $filePath = Join-Path $PSScriptRoot $urlPath.Replace("/", "\").TrimStart("\")

        if (Test-Path $filePath -PathType Leaf) {
            # Read file content
            $bytes = [System.IO.File]::ReadAllBytes($filePath)

            # Setup response headers
            $extension = [System.IO.Path]::GetExtension($filePath)
            $response.ContentType = Get-MimeType $extension
            $response.ContentLength64 = $bytes.Length

            # Write to output stream
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # 404 Not Found
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch [System.Management.Automation.PipelineStoppedException] {
        # Graceful exit on break
        break
    } catch {
        # Connection closed/aborted
        if ($null -ne $response) {
            $response.Close()
        }
    }
}

$listener.Stop()
