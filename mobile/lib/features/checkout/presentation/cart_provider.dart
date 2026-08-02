import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/menu_item_summary.dart';

class CartItem {
  final MenuItemSummary item;
  int quantity;

  CartItem({required this.item, this.quantity = 1});

  double get totalPrice => item.price * quantity;
}

class CartState {
  final List<CartItem> items;
  final String? restaurantId;
  final String? restaurantName;

  CartState({
    this.items = const [],
    this.restaurantId,
    this.restaurantName,
  });

  double get totalAmount => items.fold(0, (sum, item) => sum + item.totalPrice);

  CartState copyWith({
    List<CartItem>? items,
    String? restaurantId,
    String? restaurantName,
  }) {
    return CartState(
      items: items ?? this.items,
      restaurantId: restaurantId ?? this.restaurantId,
      restaurantName: restaurantName ?? this.restaurantName,
    );
  }
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(CartState());

  void addItem(MenuItemSummary item, String restaurantId, String restaurantName) {
    if (state.restaurantId != null && state.restaurantId != restaurantId) {
      // Different restaurant, clear cart
      state = CartState(
        items: [CartItem(item: item)],
        restaurantId: restaurantId,
        restaurantName: restaurantName,
      );
      return;
    }

    final existingIndex = state.items.indexWhere((i) => i.item.id == item.id);
    if (existingIndex >= 0) {
      final newItems = List<CartItem>.from(state.items);
      newItems[existingIndex].quantity += 1;
      state = state.copyWith(items: newItems, restaurantId: restaurantId, restaurantName: restaurantName);
    } else {
      state = state.copyWith(
        items: [...state.items, CartItem(item: item)],
        restaurantId: restaurantId,
        restaurantName: restaurantName,
      );
    }
  }

  void removeItem(String itemId) {
    final existingIndex = state.items.indexWhere((i) => i.item.id == itemId);
    if (existingIndex >= 0) {
      final newItems = List<CartItem>.from(state.items);
      if (newItems[existingIndex].quantity > 1) {
        newItems[existingIndex].quantity -= 1;
      } else {
        newItems.removeAt(existingIndex);
      }

      state = state.copyWith(
        items: newItems,
        restaurantId: newItems.isEmpty ? null : state.restaurantId,
        restaurantName: newItems.isEmpty ? null : state.restaurantName,
      );
    }
  }

  void clear() {
    state = CartState();
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier();
});
