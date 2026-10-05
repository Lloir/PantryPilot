package com.pantrypal.app.model

data class InventoryItem(
    val id: String,
    val name: String,
    val category: String,
    val quantity: Double,
    val unit: String,
    val unitPrice: Double,
    val totalCost: Double,
    val purchaseDate: String,
    val expirationDate: String,
    val location: String, // "Pantry", "Fridge", "Freezer"
    val barcode: String? = null,
    val notes: String? = null
)

data class RecipeIngredient(
    val name: String,
    val quantity: Double,
    val unit: String
)

data class Recipe(
    val id: String,
    val title: String,
    val description: String,
    val category: String,
    val prepTimeMinutes: Int,
    val cookTimeMinutes: Int,
    val servings: Int,
    val ingredients: List<RecipeIngredient>,
    val instructions: List<String>,
    val tags: List<String> = emptyList()
)

data class PlannedMeal(
    val id: String,
    val recipeId: String? = null,
    val customMealName: String,
    val date: String, // YYYY-MM-DD
    val mealType: String, // "Breakfast", "Lunch", "Dinner", "Snack"
    val servings: Int = 2
)

data class ShoppingItem(
    val id: String,
    val name: String,
    val category: String,
    val quantity: Double,
    val unit: String,
    val estimatedCost: Double,
    val checked: Boolean = false,
    val reason: String? = null
)

data class CookedMealLog(
    val id: String,
    val recipeTitle: String,
    val cookedAt: String,
    val servings: Int,
    val totalCost: Double,
    val costPerServing: Double
)
