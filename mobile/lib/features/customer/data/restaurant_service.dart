import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/menu_item_summary.dart';
import '../../../core/models/restaurant_summary.dart';
import '../../../network/api_client.dart';

final restaurantServiceProvider = Provider<RestaurantService>(
  (ref) => RestaurantService(ref.watch(dioProvider)),
);

final restaurantsProvider = FutureProvider<List<RestaurantSummary>>((ref) {
  return ref.watch(restaurantServiceProvider).getRestaurants();
});

final customerCatalogProvider = FutureProvider<CustomerCatalog>((ref) {
  return ref.watch(restaurantServiceProvider).getCustomerCatalog();
});

class CustomerCatalog {
  const CustomerCatalog({
    required this.restaurants,
    required this.products,
  });

  final List<RestaurantSummary> restaurants;
  final List<MenuItemSummary> products;
}

class RestaurantService {
  const RestaurantService(this._dio);

  final Dio _dio;

  Future<List<RestaurantSummary>> getRestaurants() async {
    final response = await _dio.get<List<dynamic>>('/restaurants');
    final data = response.data ?? <dynamic>[];
    return data
        .whereType<Map>()
        .map((item) => RestaurantSummary.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  Future<List<MenuItemSummary>> getMenuItems({
    required String restaurantId,
    required String restaurantName,
  }) async {
    final response = await _dio.get<List<dynamic>>('/restaurants/$restaurantId/menu');
    final data = response.data ?? <dynamic>[];
    return data
        .whereType<Map>()
        .map(
          (item) => MenuItemSummary.fromJson(
            item.cast<String, dynamic>(),
            restaurantName: restaurantName,
          ),
        )
        .toList();
  }

  Future<CustomerCatalog> getCustomerCatalog() async {
    final restaurants = await getRestaurants();
    final menus = await Future.wait(
      restaurants.map((restaurant) async {
        try {
          return await getMenuItems(
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
          );
        } catch (_) {
          return <MenuItemSummary>[];
        }
      }),
    );

    return CustomerCatalog(
      restaurants: restaurants,
      products: menus.expand((items) => items).toList()
        ..sort((a, b) {
          if (a.isAvailable != b.isAvailable) {
            return a.isAvailable ? -1 : 1;
          }
          if (a.sortOrder != b.sortOrder) {
            return a.sortOrder.compareTo(b.sortOrder);
          }
          return a.name.compareTo(b.name);
        }),
    );
  }
}
