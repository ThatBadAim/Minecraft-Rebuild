using System;
using System.Collections.Generic;

namespace VoxelEngine.ToolSystem;

public class ToolInstance
{
    public ToolDefinition Definition { get; }
    public MaterialTier? Tier { get; }
    public int CurrentDurability { get; set; }
    public int MaxDurability => Tier?.Durability ?? Definition.BaseDurability;

    public List<IEnchantmentModifier> Enchantments { get; } = new();

    public ToolInstance(ToolDefinition definition, MaterialTier? tier = null)
    {
        Definition = definition;
        Tier = tier;
        CurrentDurability = MaxDurability;
    }
}
