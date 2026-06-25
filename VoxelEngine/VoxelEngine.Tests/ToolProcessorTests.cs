using System.Collections.Generic;
using VoxelEngine.ToolSystem;
using Xunit;

namespace VoxelEngine.Tests;

public class ToolProcessorTests
{
    private readonly ToolProcessor _processor = new();

    [Fact]
    public void ProcessBlockBreak_MatchingToolAndLevel_ReturnsSuccessAndDropsLoot()
    {
        var pickaxeDef = new ToolDefinition("iron_pickaxe", ToolType.Pickaxe, true, SupportedTags: new HashSet<string> { BlockTags.MineableWithPickaxe });
        var tool = new ToolInstance(pickaxeDef, MaterialTiers.Iron);

        var stoneBlock = new BlockData { Id = "stone", Tags = new HashSet<string> { BlockTags.MineableWithPickaxe }, RequiredMiningLevel = 1 };

        var result = _processor.ProcessBlockBreak(tool, stoneBlock);

        Assert.True(result.Success);
        Assert.True(result.DropsLoot);
        Assert.Equal(6.0f, result.MiningSpeed); // Iron speed
        Assert.Equal(249, tool.CurrentDurability); // 250 - 1
    }

    [Fact]
    public void ProcessBlockBreak_InsufficientMiningLevel_ReturnsPenaltyAndNoLoot()
    {
        var pickaxeDef = new ToolDefinition("wood_pickaxe", ToolType.Pickaxe, true, SupportedTags: new HashSet<string> { BlockTags.MineableWithPickaxe });
        var tool = new ToolInstance(pickaxeDef, MaterialTiers.Wood); // Level 0

        var ironOreBlock = new BlockData { Id = "iron_ore", Tags = new HashSet<string> { BlockTags.MineableWithPickaxe }, RequiredMiningLevel = 1 };

        var result = _processor.ProcessBlockBreak(tool, ironOreBlock);

        Assert.True(result.Success);
        Assert.False(result.DropsLoot);
        Assert.Equal(1.0f, result.MiningSpeed); // Base penalty speed due to insufficient level
        Assert.Equal(58, tool.CurrentDurability); // 59 - 1
    }

    [Fact]
    public void ProcessBlockBreak_IncorrectTool_ReturnsPenaltySpeedAndHighDurabilityLoss()
    {
        var axeDef = new ToolDefinition("stone_axe", ToolType.Axe, true, SupportedTags: new HashSet<string> { BlockTags.MineableWithAxe });
        var tool = new ToolInstance(axeDef, MaterialTiers.Stone);

        var stoneBlock = new BlockData { Id = "stone", Tags = new HashSet<string> { BlockTags.MineableWithPickaxe }, RequiredMiningLevel = 0 };

        var result = _processor.ProcessBlockBreak(tool, stoneBlock);

        Assert.True(result.Success);
        Assert.False(result.DropsLoot);
        Assert.Equal(1.0f, result.MiningSpeed); // Base penalty
        Assert.Equal(129, tool.CurrentDurability); // 131 - 2
    }

    [Fact]
    public void RepairTool_SameTypeAndTier_MergesDurabilityWithBonus()
    {
        var pickaxeDef = new ToolDefinition("iron_pickaxe", ToolType.Pickaxe, true, SupportedTags: new HashSet<string> { BlockTags.MineableWithPickaxe });

        var tool1 = new ToolInstance(pickaxeDef, MaterialTiers.Iron) { CurrentDurability = 100 };
        var tool2 = new ToolInstance(pickaxeDef, MaterialTiers.Iron) { CurrentDurability = 50 };

        var repaired = _processor.RepairTool(tool1, tool2);

        Assert.NotNull(repaired);
        // 100 + 50 + (250 * 0.05 = 12.5 -> 12) = 162
        Assert.Equal(162, repaired!.CurrentDurability);
    }
}
