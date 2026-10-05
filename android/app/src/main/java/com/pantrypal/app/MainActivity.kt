package com.pantrypal.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.pantrypal.app.model.InventoryItem

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF059669),
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFD1FAE5),
                    onPrimaryContainer = Color(0xFF065F46),
                    secondary = Color(0xFF0D9488),
                    surface = Color.White,
                    background = Color(0xFFF5F5F4)
                )
            ) {
                PantryPalAndroidApp()
            }
        }
    }
}

enum class AndroidNavTab(val title: String) {
    INVENTORY("Pantry"),
    RECIPES("Recipes"),
    PLANNER("Planner"),
    SHOPPING("Shopping"),
    ANALYTICS("Analytics")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PantryPalAndroidApp() {
    var selectedTab by remember { mutableStateOf(AndroidNavTab.INVENTORY) }
    var items by remember {
        mutableStateOf(
            listOf(
                InventoryItem("1", "Organic Baby Spinach", "Produce", 16.0, "oz", 3.99, 3.99, "2026-10-05", "2026-10-08", "Fridge"),
                InventoryItem("2", "Chicken Breasts", "Meat & Seafood", 2.0, "lb", 4.99, 9.98, "2026-10-04", "2026-10-09", "Fridge"),
                InventoryItem("3", "Jasmine Rice", "Pantry & Grains", 5.0, "lb", 1.80, 8.99, "2026-09-20", "2027-09-20", "Pantry"),
                InventoryItem("4", "Large Grade A Eggs", "Dairy & Eggs", 12.0, "count", 0.35, 4.19, "2026-10-03", "2026-10-24", "Fridge")
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "PantryPal",
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = "Smart Grocery & Meal Planner",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { /* Launch ML Kit Camera Scanner */ }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan Barcode")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* Launch Camera Receipt OCR */ },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(Icons.Default.ReceiptLong, contentDescription = "Scan Receipt")
            }
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                AndroidNavTab.values().forEach { tab ->
                    val isSelected = selectedTab == tab
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { selectedTab = tab },
                        icon = {
                            when (tab) {
                                AndroidNavTab.INVENTORY -> Icon(Icons.Default.Kitchen, contentDescription = tab.title)
                                AndroidNavTab.RECIPES -> Icon(Icons.Default.RestaurantMenu, contentDescription = tab.title)
                                AndroidNavTab.PLANNER -> Icon(Icons.Default.CalendarMonth, contentDescription = tab.title)
                                AndroidNavTab.SHOPPING -> Icon(Icons.Default.ShoppingCart, contentDescription = tab.title)
                                AndroidNavTab.ANALYTICS -> Icon(Icons.Default.Insights, contentDescription = tab.title)
                            }
                        },
                        label = { Text(tab.title) }
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (selectedTab) {
                AndroidNavTab.INVENTORY -> AndroidInventoryScreen(items)
                AndroidNavTab.RECIPES -> AndroidRecipesScreen()
                AndroidNavTab.PLANNER -> AndroidPlannerScreen()
                AndroidNavTab.SHOPPING -> AndroidShoppingScreen()
                AndroidNavTab.ANALYTICS -> AndroidAnalyticsScreen()
            }
        }
    }
}

@Composable
fun AndroidInventoryScreen(items: List<InventoryItem>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Pantry Overview", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text("${items.size} Items in Stock • \$27.15 Total Value", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        items(items) { item ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.name, style = MaterialTheme.typography.titleSmall)
                        Text("${item.quantity} ${item.unit} • ${item.category}", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                        Text("Expires: ${item.expirationDate} (${item.location})", style = MaterialTheme.typography.labelSmall, color = Color(0xFFD97706))
                    }
                    Text("\$${String.format("%.2f", item.totalCost)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

@Composable
fun AndroidRecipesScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Smart Recipe Suggestions", style = MaterialTheme.typography.titleLarge)
        Text("Prioritizing ingredients expiring soon", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Lemon Herb Garlic Chicken", style = MaterialTheme.typography.titleMedium)
                Text("Uses: Chicken Breasts (expiring in 4 days), Olive oil, Garlic", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Cost to cook: \$5.62 • 25 mins", style = MaterialTheme.typography.labelMedium, color = Color(0xFF059669))
            }
        }
    }
}

@Composable
fun AndroidPlannerScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Weekly Meal Calendar", style = MaterialTheme.typography.titleLarge)
        Text("Forecasts stock depletion before you cook", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
    }
}

@Composable
fun AndroidShoppingScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Smart Shopping List", style = MaterialTheme.typography.titleLarge)
        Text("Auto-generated from recipe ingredient deficits", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
    }
}

@Composable
fun AndroidAnalyticsScreen() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Cost & Spending Analytics", style = MaterialTheme.typography.titleLarge)
        Text("Track grocery spend vs home-cooked cost per meal", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
    }
}
