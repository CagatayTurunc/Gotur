import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../network/api_client.dart';
import '../../../router/app_router.dart';
import 'cart_provider.dart';

class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({super.key});

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  bool _isLoading = false;
  final TextEditingController _addressController = TextEditingController(text: 'Ev Adresi - Test Mah. 123 Sok.');

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      final itemsMap = cart.items.map((i) => {
        'menuItemId': i.item.id,
        'quantity': i.quantity,
        'unitPrice': i.item.price,
        'totalPrice': i.totalPrice,
      }).toList();

      final response = await ref.read(dioProvider).post('/api/orders', data: {
        'restaurantId': cart.restaurantId,
        'deliveryAddress': _addressController.text,
        'deliveryLocation': {
          'latitude': 41.0082,
          'longitude': 28.9784,
        },
        'items': itemsMap,
      });

      final orderId = response.data['id'];
      ref.read(cartProvider.notifier).clear();
      
      if (mounted) {
        context.go(AppRouter.tracking(orderId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sipariş oluşturulamadı: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sepetim')),
      body: cart.items.isEmpty
          ? const Center(child: Text('Sepetiniz boş.'))
          : ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  cart.restaurantName ?? '',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                ...cart.items.map((item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item.item.name),
                      subtitle: Text('${item.item.price} TL x ${item.quantity}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('${item.totalPrice} TL', style: const TextStyle(fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                            onPressed: () => ref.read(cartProvider.notifier).removeItem(item.item.id),
                          ),
                        ],
                      ),
                    )),
                const Divider(height: 32),
                TextField(
                  controller: _addressController,
                  decoration: const InputDecoration(
                    labelText: 'Teslimat Adresi',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Toplam:', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    Text('${cart.totalAmount} TL', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                  ],
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _isLoading ? null : _placeOrder,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Colors.deepPurple,
                    foregroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white))
                      : const Text('Siparişi Onayla', style: TextStyle(fontSize: 16)),
                ),
              ],
            ),
    );
  }
}

