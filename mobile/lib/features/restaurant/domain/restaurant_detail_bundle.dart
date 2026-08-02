import '../../../core/models/menu_item_summary.dart';
import '../../../core/models/restaurant_summary.dart';

class RestaurantDetailBundle {
  const RestaurantDetailBundle({
    required this.restaurant,
    required this.products,
  });

  final RestaurantSummary restaurant;
  final List<MenuItemSummary> products;
}
