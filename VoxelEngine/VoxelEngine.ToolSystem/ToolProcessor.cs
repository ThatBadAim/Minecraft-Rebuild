using System;
using System.Linq;

namespace VoxelEngine.ToolSystem;

public readonly record struct BlockBreakResult(
    bool Success,
    float MiningSpeed,
    bool DropsLoot
);

public class ToolProcessor
{
    private const float BasePenaltySpeed = 1.0f;
    private const int SuccessfulBreakDurabilityCost = 1;
    private const int PenaltyBreakDurabilityCost = 2;
    private const float RepairBonusPercentage = 0.05f;

    public BlockBreakResult ProcessBlockBreak(ToolInstance tool, BlockData block)
    {
        bool isCompatible = false;
        foreach (var tag in tool.Definition.Tags)
        {
            if (block.Tags.Contains(tag))
            {
                isCompatible = true;
                break;
            }
        }

        int toolMiningLevel = tool.Tier?.MiningLevel ?? 0;
        bool meetsMiningLevel = toolMiningLevel >= block.RequiredMiningLevel;

        float speedMultiplier;
        if (isCompatible && meetsMiningLevel && tool.Tier.HasValue)
        {
            speedMultiplier = tool.Tier.Value.MiningSpeedMultiplier;
            // Apply Efficiency Enchantment if compatible and meets mining level requirements
            var efficiency = tool.Enchantments.OfType<EfficiencyEnchantment>().FirstOrDefault();
            if (efficiency != null)
            {
                // Linear scaling as requested
                speedMultiplier += efficiency.Level;
            }
        }
        else
        {
            speedMultiplier = BasePenaltySpeed;
        }

        bool dropsLoot = isCompatible && meetsMiningLevel;

        int durabilityCost = isCompatible ? SuccessfulBreakDurabilityCost : PenaltyBreakDurabilityCost;

        ConsumeDurability(tool, durabilityCost);

        return new BlockBreakResult(
            Success: true,
            MiningSpeed: speedMultiplier,
            DropsLoot: dropsLoot
        );
    }

    private void ConsumeDurability(ToolInstance tool, int baseCost)
    {
        if (tool.MaxDurability <= 0) return; // Unbreakable or utility tool with no durability

        int actualCost = 0;
        var unbreaking = tool.Enchantments.OfType<UnbreakingEnchantment>().FirstOrDefault();

        for (int i = 0; i < baseCost; i++)
        {
            // Unbreaking chance to ignore durability loss: (100 / (Level + 1))% chance to consume
            if (unbreaking == null || Random.Shared.NextDouble() < (1.0 / (unbreaking.Level + 1)))
            {
                actualCost++;
            }
        }

        tool.CurrentDurability = Math.Max(0, tool.CurrentDurability - actualCost);
    }

    public ToolInstance? RepairTool(ToolInstance tool1, ToolInstance tool2)
    {
        if (tool1.Definition.Id != tool2.Definition.Id)
        {
            return null; // Cannot repair different tools
        }

        if (tool1.Tier?.Name != tool2.Tier?.Name)
        {
            return null;
        }

        int maxDurability = tool1.MaxDurability;
        int durability1 = tool1.CurrentDurability;
        int durability2 = tool2.CurrentDurability;

        int bonus = (int)(maxDurability * RepairBonusPercentage);
        int newDurability = Math.Min(maxDurability, durability1 + durability2 + bonus);

        var repairedTool = new ToolInstance(tool1.Definition, tool1.Tier)
        {
            CurrentDurability = newDurability
        };

        // Note: Enchantment merging logic would go here, often taking the max level or combining

        return repairedTool;
    }
}
