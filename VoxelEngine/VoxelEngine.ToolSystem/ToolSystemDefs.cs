using System;
using System.Collections.Generic;

namespace VoxelEngine.ToolSystem;

public enum ToolType
{
    Pickaxe,
    Axe,
    Shovel,
    Hoe,
    Shears,
    FlintAndSteel,
    FishingRod,
    Brush,
    Shield,
    Compass,
    Clock
}

public static class BlockTags
{
    public const string MineableWithPickaxe = "MineableWithPickaxe";
    public const string MineableWithAxe = "MineableWithAxe";
    public const string MineableWithShovel = "MineableWithShovel";
    public const string MineableWithHoe = "MineableWithHoe";
}

public readonly record struct ToolDefinition(
    string Id,
    ToolType Type,
    bool IsTiered,
    int BaseDurability = 0,
    HashSet<string>? SupportedTags = null
)
{
    public HashSet<string> Tags => SupportedTags ?? new HashSet<string>();
}

public class BlockData
{
    public string Id { get; init; } = string.Empty;
    public HashSet<string> Tags { get; init; } = new();
    public int RequiredMiningLevel { get; init; } = 0;
}
