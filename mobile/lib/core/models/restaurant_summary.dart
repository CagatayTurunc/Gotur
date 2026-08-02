class RestaurantSummary {
  const RestaurantSummary({
    required this.id,
    required this.name,
    required this.address,
    required this.description,
    required this.logoUrl,
    required this.isOpen,
    required this.locationLat,
    required this.locationLng,
  });

  final String id;
  final String name;
  final String address;
  final String description;
  final String? logoUrl;
  final bool isOpen;
  final double locationLat;
  final double locationLng;

  factory RestaurantSummary.fromJson(Map<String, dynamic> json) {
    return RestaurantSummary(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Restoran',
      address: json['address']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      logoUrl: json['logoUrl']?.toString(),
      isOpen: json['isOpen'] == true,
      locationLat: (json['locationLat'] as num?)?.toDouble() ?? 0,
      locationLng: (json['locationLng'] as num?)?.toDouble() ?? 0,
    );
  }
}
