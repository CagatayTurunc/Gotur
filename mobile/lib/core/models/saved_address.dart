class SavedAddress {
  const SavedAddress({
    required this.id,
    required this.label,
    required this.fullAddress,
    required this.lat,
    required this.lng,
  });

  final String id;
  final String label;
  final String fullAddress;
  final double lat;
  final double lng;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'fullAddress': fullAddress,
    'lat': lat,
    'lng': lng,
  };

  factory SavedAddress.fromJson(Map<String, dynamic> json) {
    return SavedAddress(
      id: json['id']?.toString() ?? '',
      label: json['label']?.toString() ?? 'Ev',
      fullAddress: json['fullAddress']?.toString() ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
    );
  }
}
