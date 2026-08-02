import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/saved_address.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../network/api_client.dart';

const _savedAddressesKey = 'saved_addresses';
const _selectedAddressKey = 'selected_address';

final addressStorageProvider = Provider<AddressStorage>(
  (ref) => AddressStorage(ref.watch(secureStorageProvider)),
);

class AddressStorage {
  const AddressStorage(this._storage);

  final SecureStorageService _storage;

  Future<List<SavedAddress>> readAddresses() async {
    final raw = await _storage.read(_savedAddressesKey);
    if (raw == null || raw.isEmpty) {
      return const [];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return const [];
    }

    return decoded
        .whereType<Map>()
        .map((item) => SavedAddress.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  Future<SavedAddress?> readSelectedAddress() async {
    final raw = await _storage.read(_selectedAddressKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return SavedAddress.fromJson(
      (jsonDecode(raw) as Map).cast<String, dynamic>(),
    );
  }

  Future<void> saveAddresses(List<SavedAddress> addresses) {
    return _storage.write(
      _savedAddressesKey,
      jsonEncode(addresses.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> saveSelectedAddress(SavedAddress? address) async {
    if (address == null) {
      await _storage.delete(_selectedAddressKey);
      return;
    }

    await _storage.write(_selectedAddressKey, jsonEncode(address.toJson()));
  }
}
