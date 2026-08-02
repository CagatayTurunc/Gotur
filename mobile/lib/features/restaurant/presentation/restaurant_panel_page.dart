import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../../network/api_client.dart';
import '../../auth/presentation/auth_controller.dart';

class RestaurantPanelPage extends ConsumerStatefulWidget {
  const RestaurantPanelPage({super.key});

  @override
  ConsumerState<RestaurantPanelPage> createState() => _RestaurantPanelPageState();
}

class _RestaurantPanelPageState extends ConsumerState<RestaurantPanelPage> {
  Map<String, dynamic>? _restaurantData;
  List<dynamic> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    initializeDateFormatting('tr_TR', null).then((_) {
      _fetchData();
    });
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(dioProvider);
      final restaurantRes = await dio.get('/api/restaurants/mine');
      final ordersRes = await dio.get('/api/orders?pageSize=50');
      
      if (mounted) {
        setState(() {
          _restaurantData = restaurantRes.data;
          _orders = ordersRes.data['items'] ?? [];
        });
      }
    } catch (e) {
      debugPrint('Restaurant fetch error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleStatus(bool value) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.patch('/api/restaurants/mine', data: {'isOpen': value});
      _fetchData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Durum güncellenemedi: $e')));
      }
    }
  }

  Future<void> _updateOrderStatus(String orderId, String newStatus) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.patch('/api/orders/$orderId/status', data: {'status': newStatus});
      _fetchData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sipariş güncellenemedi: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeOrders = _orders.where((o) => ['Pending', 'ReadyForPickup', 'Assigned', 'Picked'].contains(o['status'])).toList();
    final deliveredOrders = _orders.where((o) => o['status'] == 'Delivered').toList();
    
    double totalSales = 0;
    for (var order in deliveredOrders) {
      totalSales += (order['totalAmount'] ?? 0);
    }

    final dateStr = DateFormat('d MMMM EEEE', 'tr_TR').format(DateTime.now());
    final restaurantName = _restaurantData?['name'] ?? 'Restoran';
    final isOpen = _restaurantData?['isOpen'] ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFFFFF8F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFF0EE),
        elevation: 0,
        title: Row(
          children: [
            const Text('Dashboard', style: TextStyle(color: Color(0xFF6F0001), fontWeight: FontWeight.bold)),
            const Spacer(),
            Row(
              children: [
                const Text('Durum:', style: TextStyle(color: Colors.black54, fontSize: 12)),
                const SizedBox(width: 8),
                Switch(
                  value: isOpen,
                  onChanged: _toggleStatus,
                  activeColor: Colors.redAccent,
                ),
                Text(isOpen ? 'Açık' : 'Kapalı', style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (mounted) {
                context.go('/customer');
              }
            },
            tooltip: 'Çıkış Yap',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Karşılama
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Hoş Geldiniz, $restaurantName!', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87)),
                            const SizedBox(height: 4),
                            const Text('Bugün restoranınızda neler oluyor bir bakın.', style: TextStyle(color: Colors.black54)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.red.shade100),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today, size: 16, color: Colors.redAccent),
                            const SizedBox(width: 8),
                            Text(dateStr, style: const TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 24),

                  // İstatistik Kartları
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.5,
                    children: [
                      _buildStatCard('BUGÜNKÜ SATIŞ', '${totalSales.toStringAsFixed(0)} ₺', Icons.account_balance_wallet, '+15% dünden'),
                      _buildStatCard('AKTİF SİPARİŞ', '${activeOrders.length}', Icons.shopping_bag, '${deliveredOrders.length} teslim edildi'),
                      _buildStatCard('RESTORAN PUANI', '4.8', Icons.star, '1000+ değerlendirme'),
                      _buildStatCard('ORT. HAZIRLIK', '18 dk', Icons.timer, 'Hedef sürede'),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Canlı Siparişler
                  const Text('Canlı Siparişler', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87)),
                  const SizedBox(height: 12),
                  if (activeOrders.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: const Center(
                        child: Column(
                          children: [
                            Icon(Icons.receipt_long, size: 48, color: Colors.black26),
                            SizedBox(height: 8),
                            Text('Aktif sipariş yok', style: TextStyle(color: Colors.black54)),
                          ],
                        ),
                      ),
                    )
                  else
                    ...activeOrders.map((order) => _buildActiveOrderCard(order)),

                  const SizedBox(height: 32),

                  // Bugün Tamamlananlar
                  const Text('Bugün Tamamlananlar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87)),
                  const SizedBox(height: 12),
                  if (deliveredOrders.isEmpty)
                    const Text('Henüz tamamlanan sipariş yok.', style: TextStyle(color: Colors.black54))
                  else
                    Container(
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        children: deliveredOrders.take(5).map((order) {
                          return ListTile(
                            title: Text(order['deliveryAddress'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${order['totalAmount']} ₺'),
                            trailing: const Text('✓ Teslim', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                          );
                        }).toList(),
                      ),
                    ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, spreadRadius: 2)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black54)),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: const Color(0xFFFFF0EE), shape: BoxShape.circle),
                child: Icon(icon, size: 16, color: Colors.redAccent),
              ),
            ],
          ),
          const Spacer(),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF6F0001))),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: Colors.black45)),
        ],
      ),
    );
  }

  Widget _buildActiveOrderCard(Map<String, dynamic> order) {
    final status = order['status'];
    String statusLabel = '';
    Color statusColor = Colors.grey;

    if (status == 'Pending') {
      statusLabel = 'Hazırlanıyor';
      statusColor = Colors.orange;
    } else if (status == 'ReadyForPickup') {
      statusLabel = 'Kurye Bekleniyor';
      statusColor = Colors.green;
    } else if (status == 'Assigned' || status == 'Picked') {
      statusLabel = 'Kuryede';
      statusColor = Colors.blue;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(order['deliveryAddress'] ?? 'Adres', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: statusColor.withOpacity(0.5))),
                  child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Tutar: ${order['totalAmount']} ₺', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            if (status == 'Pending')
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                  onPressed: () => _updateOrderStatus(order['id'], 'ReadyForPickup'),
                  child: const Text('Hazır, Kurye Çağır'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
