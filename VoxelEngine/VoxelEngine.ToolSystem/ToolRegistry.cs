using System;
using System.Collections.Generic;

namespace VoxelEngine.ToolSystem;

public class ToolRegistry
{
    private readonly Dictionary<string, ToolDefinition> _tools = new();

    public void RegisterTool(ToolDefinition tool)
    {
        if (!_tools.TryAdd(tool.Id, tool))
        {
            throw new ArgumentException($"Tool with ID '{tool.Id}' is already registered.");
        }
    }

    public ToolDefinition GetTool(string id)
    {
        if (_tools.TryGetValue(id, out var tool))
        {
            return tool;
        }
        throw new KeyNotFoundException($"Tool with ID '{id}' not found.");
    }
}
