namespace VoxelEngine.ToolSystem;

public interface IEnchantmentModifier
{
    string Name { get; }
    int Level { get; }
}

public abstract record EnchantmentModifier(string Name, int Level) : IEnchantmentModifier;

public record EfficiencyEnchantment(int Level) : EnchantmentModifier("Efficiency", Level);
public record UnbreakingEnchantment(int Level) : EnchantmentModifier("Unbreaking", Level);
public record MendingEnchantment() : EnchantmentModifier("Mending", 1);
public record FortuneEnchantment(int Level) : EnchantmentModifier("Fortune", Level);
public record SilkTouchEnchantment() : EnchantmentModifier("Silk Touch", 1);
