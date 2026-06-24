namespace VoxelEngine.ToolSystem;

public readonly record struct MaterialTier(
    string Name,
    int Durability,
    float MiningSpeedMultiplier,
    int MiningLevel,
    bool IsFireproof = false
);

public static class MaterialTiers
{
    public static readonly MaterialTier Wood = new("Wood", 59, 2.0f, 0);
    public static readonly MaterialTier Stone = new("Stone", 131, 4.0f, 1);
    public static readonly MaterialTier Iron = new("Iron", 250, 6.0f, 2);
    public static readonly MaterialTier Gold = new("Gold", 32, 12.0f, 0);
    public static readonly MaterialTier Diamond = new("Diamond", 1561, 8.0f, 3);
    public static readonly MaterialTier Netherite = new("Netherite", 2031, 9.0f, 4, IsFireproof: true);
}
