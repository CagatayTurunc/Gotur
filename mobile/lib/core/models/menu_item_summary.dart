class MenuItemSummary {
  const MenuItemSummary({
    required this.id,
    required this.restaurantId,
    required this.restaurantName,
    required this.name,
    required this.description,
    required this.category,
    required this.imageUrl,
    required this.price,
    required this.isAvailable,
    required this.sortOrder,
  });

  final String id;
  final String restaurantId;
  final String restaurantName;
  final String name;
  final String description;
  final String category;
  final String? imageUrl;
  final double price;
  final bool isAvailable;
  final int sortOrder;

  factory MenuItemSummary.fromJson(
    Map<String, dynamic> json, {
    required String restaurantName,
  }) {
    return MenuItemSummary(
      id: json['id']?.toString() ?? '',
      restaurantId: json['restaurantId']?.toString() ?? '',
      restaurantName: restaurantName,
      name: json['name']?.toString() ?? 'Ürün',
      description: json['description']?.toString() ?? '',
      category: json['category']?.toString() ?? 'Diğer',
      imageUrl: json['imageUrl']?.toString(),
      price: (json['price'] as num?)?.toDouble() ?? 0,
      isAvailable: json['isAvailable'] != false,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
