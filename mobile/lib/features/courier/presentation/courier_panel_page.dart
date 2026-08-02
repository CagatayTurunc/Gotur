import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../network/api_client.dart';
import '../../auth/presentation/auth_controller.dart';

class CourierPanelPage extends ConsumerStatefulWidget {
  const CourierPanelPage({super.key});

  @override
  ConsumerState<CourierPanelPage> createState() => _CourierPanelPageState();
}

class _CourierPanelPageState extends ConsumerState<CourierPanelPage> {
  final MapController _mapController = MapController();
  final LatLng _initialCenter = const LatLng(40.990, 29.020); // Kadıköy

  Map<String, dynamic>? _courierProfile;
  Map<String, dynamic>? _activeOrder;
  List<dynamic> _availableOrders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      await Future.wait([
        _fetchProfile(),
        _fetchActiveOrder(),
        _fetchAvailableOrders(),
      ]);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _fetchProfile() async {
    try {
      final response = await ref.read(dioProvider).get('/api/couriers/me');
      _courierProfile = response.data;
    } catch (e) {
      debugPrint('Profil hatası: $e');
    }
  }

  Future<void> _fetchActiveOrder() async {
    try {
      final response = await ref.read(dioProvider).get('/api/couriers/my-order');
      _activeOrder = response.data;
    } catch (e) {
      _activeOrder = null;
    }
  }

  Future<void> _fetchAvailableOrders() async {
    try {
      final response = await ref.read(dioProvider).get('/api/couriers/available-orders');
      _availableOrders = response.data;
    } catch (e) {
      _availableOrders = [];
    }
  }

  Future<void> _acceptOrder(String orderId) async {
    try {
      await ref.read(dioProvider).post('/api/couriers/accept-order/$orderId');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sipariş kabul edildi')));
        _fetchData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sipariş kabul edilemedi: $e')));
      }
    }
  }

  Future<void> _updateStatus(String status) async {
    if (_activeOrder == null) return;
    try {
      await ref.read(dioProvider).patch('/api/orders/${_activeOrder!['id']}/status', data: {
        'status': status,
      });
      _fetchData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Durum güncellenemedi: $e')));
      }
    }
  }

  void _showHistory() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => const _CourierHistoryModal(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E1E1E).withOpacity(0.95),
        elevation: 0,
        title: Row(
          children: [
            const Text(
              'Götür',
              style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 24),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: Colors.redAccent, borderRadius: BorderRadius.circular(4)),
              child: const Text('KURYE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              children: [
                Icon(Icons.circle, color: Colors.green, size: 10),
                SizedBox(width: 6),
                Text('Çevrimiçi', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          if (_courierProfile != null)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('BUGÜNKÜ KAZANÇ', style: TextStyle(color: Colors.grey, fontSize: 10)),
                  Text(
                    '₺${_courierProfile!['totalEarnings'] ?? '0.00'}',
                    style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ],
              ),
            ),
          IconButton(
            icon: const Icon(Icons.history, color: Colors.white),
            onPressed: _showHistory,
            tooltip: 'Geçmiş',
          ),
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
      body: Stack(
        children: [
          // 1. Harita Arka Planı
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter,
              initialZoom: 14.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.gotur.mobile',
              ),
              MarkerLayer(
                markers: [
                  // Kurye Konumu (Sabit Kadıköy Merkez Simüle)
                  Marker(
                    point: _initialCenter,
                    width: 60,
                    height: 60,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(Icons.delivery_dining, color: Colors.red, size: 36),
                      ),
                    ),
                  ),
                  // Hazır Sipariş Konumları (Demo için çevresinde dağıtıyoruz)
                  if (_activeOrder == null)
                    ..._availableOrders.asMap().entries.map((entry) {
                      final index = entry.key;
                      // Basitçe farklı yerlere dağıt
                      final offsetLat = (index % 2 == 0 ? 0.005 : -0.005) * (index + 1);
                      final offsetLng = (index % 3 == 0 ? 0.005 : -0.005) * (index + 1);
                      final markerPoint = LatLng(_initialCenter.latitude + offsetLat, _initialCenter.longitude + offsetLng);
                      
                      return Marker(
                        point: markerPoint,
                        width: 40,
                        height: 40,
                        child: const Icon(Icons.location_on, color: Colors.blue, size: 40),
                      );
                    }),
                ],
              ),
            ],
          ),

          // 2. Alt Panel (Sipariş Yönetimi)
          Positioned(
            left: 16,
            right: 16,
            bottom: 32,
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _buildBottomPanel(),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomPanel() {
    if (_activeOrder != null) {
      // Aktif Sipariş Var
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, spreadRadius: 2)],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.directions_bike, color: Colors.redAccent),
                SizedBox(width: 8),
                Text('Aktif Sipariş', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(color: Colors.grey),
            Text('Restoran: ${_activeOrder!['restaurantName']}', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 4),
            Text('Adres: ${_activeOrder!['deliveryAddress']}', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 12),
            if (_activeOrder!['status'] == 'Assigned')
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
                onPressed: () => _updateStatus('Picked'),
                child: const Text('Teslim Aldım', style: TextStyle(color: Colors.white)),
              ),
            if (_activeOrder!['status'] == 'Picked')
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                onPressed: () => _updateStatus('Delivered'),
                child: const Text('Teslim Ettim', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
          ],
        ),
      );
    }

    // Aktif Sipariş Yok - Bekleyenler Gösteriliyor
    if (_availableOrders.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, spreadRadius: 2)],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const Icon(Icons.inbox_outlined, color: Colors.grey, size: 48),
            const SizedBox(height: 12),
            const Text('Aktif sipariş yok', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text('Yeni siparişler otomatik atanacak', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
              onPressed: _fetchData,
              child: const Text('Yenile', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    // Aktif sipariş yok ama bekleyenler var
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E).withOpacity(0.9),
        borderRadius: BorderRadius.circular(16),
      ),
      constraints: const BoxConstraints(maxHeight: 250),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Hazır Siparişler', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.refresh, color: Colors.white), onPressed: _fetchData),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.zero,
              itemCount: _availableOrders.length,
              itemBuilder: (context, index) {
                final order = _availableOrders[index];
                return Card(
                  color: Colors.grey[850],
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: ListTile(
                    title: Text(order['restaurantName'] ?? 'Restoran', style: const TextStyle(color: Colors.white)),
                    subtitle: Text(order['deliveryAddress'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      onPressed: () => _acceptOrder(order['id']),
                      child: const Text('Kabul Et', style: TextStyle(color: Colors.white)),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CourierHistoryModal extends ConsumerStatefulWidget {
  const _CourierHistoryModal();

  @override
  ConsumerState<_CourierHistoryModal> createState() => _CourierHistoryModalState();
}

class _CourierHistoryModalState extends ConsumerState<_CourierHistoryModal> {
  bool _isLoading = true;
  List<dynamic> _history = [];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final response = await ref.read(dioProvider).get('/api/couriers/history');
      if (mounted) {
        setState(() {
          _history = response.data['items'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.grey[700], borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          const Text('Sipariş Geçmişi', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _history.isEmpty
                    ? const Center(child: Text('Henüz teslim edilmiş siparişiniz yok.', style: TextStyle(color: Colors.white70)))
                    : ListView.builder(
                        itemCount: _history.length,
                        itemBuilder: (context, index) {
                          final order = _history[index];
                          return Card(
                            color: Colors.grey[850],
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: const Icon(Icons.check_circle, color: Colors.green),
                              title: Text(order['restaurantName'] ?? '', style: const TextStyle(color: Colors.white)),
                              subtitle: Text(order['deliveryAddress'] ?? '', style: const TextStyle(color: Colors.white70)),
                              trailing: const Text('+50 TL', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
