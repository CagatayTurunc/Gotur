import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/saved_address.dart';
import '../data/address_storage.dart';

class AddressState {
  const AddressState({
    required this.savedAddresses,
    required this.selectedAddress,
  });

  final List<SavedAddress> savedAddresses;
  final SavedAddress? selectedAddress;

  AddressState copyWith({
    List<SavedAddress>? savedAddresses,
    SavedAddress? selectedAddress,
    bool clearSelectedAddress = false,
  }) {
    return AddressState(
      savedAddresses: savedAddresses ?? this.savedAddresses,
      selectedAddress: clearSelectedAddress
          ? null
          : (selectedAddress ?? this.selectedAddress),
    );
  }
}

final addressControllerProvider =
    AsyncNotifierProvider<AddressController, AddressState>(
      AddressController.new,
    );

class AddressController extends AsyncNotifier<AddressState> {
  @override
  Future<AddressState> build() async {
    final storage = ref.read(addressStorageProvider);
    final savedAddresses = await storage.readAddresses();
    final selectedAddress = await storage.readSelectedAddress();

    return AddressState(
      savedAddresses: savedAddresses,
      selectedAddress: selectedAddress,
    );
  }

  Future<void> selectAddress(SavedAddress address) async {
    final current = state.valueOrNull;
    if (current == null) {
      return;
    }

    final next = current.copyWith(selectedAddress: address);
    state = AsyncData(next);
    await ref.read(addressStorageProvider).saveSelectedAddress(address);
  }
}
