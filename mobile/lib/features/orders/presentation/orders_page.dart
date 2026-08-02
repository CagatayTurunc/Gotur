import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../network/api_client.dart';
import '../../../router/app_router.dart';

class OrdersPage extends ConsumerStatefulWidget {
  const OrdersPage({super.key});

  @override
  ConsumerState<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends ConsumerState<OrdersPage> {
  bool _isLoading = true;
  List<dynamic> _orders = [];

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    try {
      final response = await ref.read(dioProvider).get('/api/orders/my');
      if (mounted) {
        setState(() {
          _orders = response.data['items'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Siparişler yüklenemedi: $e')));
        setState(() => _isLoading = false);
      }
    }
  }

  void _onOrderTapped(Map<String, dynamic> order) {
    final status = order['status'] as String?;
    if (status == 'Delivered') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Siparişiniz zaten teslim edildi.')),
      );
    } else if (status == 'Cancelled') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bu sipariş iptal edilmiştir.')),
      );
    } else {
      context.push(AppRouter.tracking(order['id']));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Siparişlerim')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(child: Text('Henüz siparişiniz bulunmuyor.'))
              : RefreshIndicator(
                  onRefresh: _fetchOrders,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _orders.length,
                    itemBuilder: (context, index) {
                      final order = _orders[index];
                      final createdAt = DateTime.parse(order['createdAt']).toLocal();
                      final formattedDate = DateFormat('dd MMM yyyy, HH:mm').format(createdAt);
                      
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: Icon(
                            order['status'] == 'Delivered' 
                                ? Icons.check_circle
                                : order['status'] == 'Cancelled'
                                    ? Icons.cancel
                                    : Icons.delivery_dining,
                            color: order['status'] == 'Delivered' 
                                ? Colors.green
                                : order['status'] == 'Cancelled'
                                    ? Colors.red
                                    : Colors.orange,
                          ),
                          title: Text(order['restaurantName'] ?? 'Bilinmeyen Restoran'),
                          subtitle: Text('Tarih: $formattedDate\nDurum: ${order['status']}'),
                          isThreeLine: true,
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _onOrderTapped(order),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

