import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/menu_item_summary.dart';
import '../../../core/models/restaurant_summary.dart';
import '../../../router/app_router.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../restaurant/domain/restaurant_detail_bundle.dart';
import '../data/restaurant_service.dart';

class CustomerHomePage extends ConsumerStatefulWidget {
  const CustomerHomePage({super.key});

  @override
  ConsumerState<CustomerHomePage> createState() => _CustomerHomePageState();
}

class _CustomerHomePageState extends ConsumerState<CustomerHomePage> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  String _sort = 'recommended';

  static const _campaignImages = <String>[
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ-O91j0bsm7n7YnWinyNPttecnXGULxJaOvfGSET7O4wr2y9BQ4hr_fyf1ZxX8jVvLVDZfZVO_GQJ91ECGTj_T76AGy9GEMagESyX-JEk16edmdwFSbBjD9KJ2eDJnjFxAYiFIXKyDYxr6BsE7oyp5bAcLxkFAThvh6K54SLwkZq96GGLh-U4MOXae4H-4KmfhuWITxj6FJOyfpd5Vf-NzLhI3XjIraGw1fBmRzVuuYwr-1WNz0JktADFmuz26rvc-xLFFTMKPrQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBmxHlIH_TQ4dGLa6cEi6SVmUHy0A6a_232Mb4yNG32qy73hnx_mE0W7IhXbz6ubMf92MXScDZCtQ_Gt2k2sfQWcnUJuWEkE_r3fpCfMSt1TGI6u-I5arEUQTYzjLF0879uITt-q-uMa6sii29U1P29ejfbM3fQjUm9A-wRfDKwGtBSmZWzrXVzztrH9DLNjPvaWcFiZZghyZT90LcYPvDrdis-31lGNIiehrDC0-Aik7sF6_Vkt5Y2tn46oULMSkKgNUVKnIsrsJw',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCpBOMa05w2MDhbOZTxWuSSDbrR0ZK0joiTUXX0bP8eKrk9egHNcLRkjGsrDj6c6Ppq663R7-GMRuZX5CntDJen_ayENzG29CXaFjLboPA_Z8CtbnpWkm3AD3FDX3-76arRpcV0JjzQR0fPpJyD5zkE9IDToi3RXcQ12a4PNCMMCq4iYx1n6sfKG4tKZvH23czGqESV3jKoltZJ9qz3ZM2fdCrpQAZpTR9lyF5ovCRsO7sHUI0xzon0-5HxnuloK8SVTE8X2bo0c-o',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<RestaurantSummary> _filterRestaurants(List<RestaurantSummary> restaurants) {
    final query = _query.trim().toLowerCase();
    final filtered = (query.isEmpty
        ? restaurants
        : restaurants.where((restaurant) {
            final haystack = [
              restaurant.name,
              restaurant.description,
              restaurant.address,
            ].join(' ').toLowerCase();
            return haystack.contains(query);
          }).toList())
      .toList();

    switch (_sort) {
      case 'open':
        filtered.sort((a, b) {
          if (a.isOpen != b.isOpen) {
            return a.isOpen ? -1 : 1;
          }
          return a.name.compareTo(b.name);
        });
        break;
      case 'az':
        filtered.sort((a, b) => a.name.compareTo(b.name));
        break;
      default:
        filtered.sort((a, b) {
          if (a.isOpen != b.isOpen) {
            return a.isOpen ? -1 : 1;
          }
          return a.name.compareTo(b.name);
        });
        break;
    }

    return filtered;
  }

  List<MenuItemSummary> _filterProducts(List<MenuItemSummary> products) {
    final query = _query.trim().toLowerCase();
    final visible = products.where((product) => product.isAvailable).toList();

    if (query.isEmpty) {
      return visible.take(10).toList();
    }

    return visible.where((product) {
      final haystack = [
        product.name,
        product.description,
        product.category,
        product.restaurantName,
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  Future<void> _requestOrderFlow() async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sipariş vermek için önce giriş yapmalısın.'),
          ),
        );
        context.push(AppRouter.login);
      }
      return;
    }

    if (mounted) {
      context.push(AppRouter.orders);
    }
  }

  void _showRestaurantSheet(
    RestaurantSummary restaurant,
    List<MenuItemSummary> products,
  ) {
    context.push(
      AppRouter.restaurantDetail(restaurant.id),
      extra: RestaurantDetailBundle(
        restaurant: restaurant,
        products: products,
      ),
    );
  }

  void _showProductSheet(MenuItemSummary product) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _DashboardColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: SizedBox(
                    height: 180,
                    width: double.infinity,
                    child: product.imageUrl == null || product.imageUrl!.isEmpty
                        ? Container(
                            color: _DashboardColors.surface,
                            child: const Icon(
                              Icons.fastfood_rounded,
                              color: Colors.white38,
                              size: 56,
                            ),
                          )
                        : CachedNetworkImage(
                            imageUrl: product.imageUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(
                              color: _DashboardColors.surface,
                              child: const Icon(
                                Icons.broken_image_outlined,
                                color: Colors.white38,
                                size: 48,
                              ),
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  product.name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  product.restaurantName,
                  style: const TextStyle(
                    color: _DashboardColors.primarySoft,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (product.description.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    product.description,
                    style: const TextStyle(color: Colors.white70, height: 1.5),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    _TagChip(label: product.category),
                    const Spacer(),
                    Text(
                      '₺${product.price.toStringAsFixed(0)}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _requestOrderFlow,
                    style: FilledButton.styleFrom(
                      backgroundColor: _DashboardColors.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(54),
                    ),
                    child: const Text('Bu ürünle siparişe başla'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).valueOrNull;
    final catalogAsync = ref.watch(customerCatalogProvider);

    return Scaffold(
      backgroundColor: _DashboardColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: _DashboardColors.primary,
          onRefresh: () async => ref.invalidate(customerCatalogProvider),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            children: [
              Container(
                color: _DashboardColors.topBanner,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: const Row(
                  children: [
                    Icon(Icons.local_fire_department_rounded,
                        color: Colors.white, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Müşteri dashboard hazır: restoranları gez, ürün ara, siparişe girişte devam et.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Götür',
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                color: _DashboardColors.primary,
                                fontWeight: FontWeight.w900,
                                fontStyle: FontStyle.italic,
                              ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: _DashboardColors.surface,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: Colors.white10),
                            ),
                            child: const Row(
                              children: [
                                Icon(
                                  Icons.location_on_rounded,
                                  color: _DashboardColors.primary,
                                  size: 18,
                                ),
                                SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    '505. Sokak',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                Icon(
                                  Icons.keyboard_arrow_down_rounded,
                                  color: Colors.white54,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            onChanged: (value) => setState(() => _query = value),
                            style: const TextStyle(color: Colors.white),
                            decoration: InputDecoration(
                              hintText: 'Yemek, ürün veya restoran ara',
                              hintStyle: const TextStyle(color: Colors.white54),
                              prefixIcon: const Icon(
                                Icons.search_rounded,
                                color: Colors.white54,
                              ),
                              suffixIcon: _query.isEmpty
                                  ? null
                                  : IconButton(
                                      onPressed: () {
                                        _searchController.clear();
                                        setState(() => _query = '');
                                      },
                                      icon: const Icon(
                                        Icons.close_rounded,
                                        color: Colors.white54,
                                      ),
                                    ),
                              filled: true,
                              fillColor: _DashboardColors.surface,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: BorderSide.none,
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: const BorderSide(color: Colors.white10),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: const BorderSide(
                                  color: _DashboardColors.primary,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        session == null
                            ? FilledButton.tonalIcon(
                                onPressed: () => context.push(AppRouter.login),
                                style: FilledButton.styleFrom(
                                  backgroundColor: _DashboardColors.surface,
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(0, 56),
                                ),
                                icon: const Icon(Icons.login_rounded),
                                label: const Text('Giriş'),
                              )
                            : PopupMenuButton<String>(
                                tooltip: 'Profil',
                                color: _DashboardColors.card,
                                onSelected: (value) async {
                                  if (value == 'profile') {
                                    context.push(AppRouter.profile);
                                    return;
                                  }
                                  await ref
                                      .read(authControllerProvider.notifier)
                                      .logout();
                                  if (!context.mounted) {
                                    return;
                                  }
                                  context.go(AppRouter.customerHome);
                                },
                                itemBuilder: (context) => const [
                                  PopupMenuItem<String>(
                                    value: 'profile',
                                    child: Text('Profil'),
                                  ),
                                  PopupMenuItem<String>(
                                    value: 'logout',
                                    child: Text('Çıkış Yap'),
                                  ),
                                ],
                                child: CircleAvatar(
                                  radius: 24,
                                  backgroundColor: _DashboardColors.primary,
                                  child: Text(
                                    session.user.fullName.characters.first
                                        .toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: const Row(
                        children: [
                          _HomeTab(
                            icon: Icons.restaurant_rounded,
                            label: 'Restoranlar',
                            isActive: true,
                          ),
                          SizedBox(width: 10),
                          _HomeTab(
                            icon: Icons.takeout_dining_rounded,
                            label: 'Al Götür',
                          ),
                          SizedBox(width: 10),
                          _HomeTab(
                            icon: Icons.local_grocery_store_rounded,
                            label: 'Market',
                          ),
                        ],
                      ),
                    ),
                    if (session == null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: _DashboardColors.surface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.lock_open_rounded,
                              color: _DashboardColors.primarySoft,
                            ),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text(
                                'Misafir olarak restoran ve ürünleri inceleyebilirsin. Siparişte giriş isteyeceğim.',
                                style: TextStyle(
                                  color: Colors.white70,
                                  height: 1.4,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.push(AppRouter.login),
                              child: const Text('Giriş Yap'),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFCE5E5),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Icon(
                              Icons.qr_code_2_rounded,
                              size: 42,
                              color: _DashboardColors.topBanner,
                            ),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Size özel kampanyalar ve daha fazlası Götür Mobil ile',
                                  style: TextStyle(
                                    color: Color(0xFF2D1212),
                                    fontWeight: FontWeight.w900,
                                    fontSize: 18,
                                  ),
                                ),
                                SizedBox(height: 6),
                                Text(
                                  'Yemekten market ürünlerine özel fırsatlar seni bekliyor.',
                                  style: TextStyle(
                                    color: Color(0xFF7A4040),
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 42,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _FilterChip(
                            label: 'Önerilen',
                            selected: _sort == 'recommended',
                            onTap: () => setState(() => _sort = 'recommended'),
                          ),
                          _FilterChip(
                            label: 'Açık Olanlar',
                            selected: _sort == 'open',
                            onTap: () => setState(() => _sort = 'open'),
                          ),
                          _FilterChip(
                            label: 'A-Z',
                            selected: _sort == 'az',
                            onTap: () => setState(() => _sort = 'az'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              catalogAsync.when(
                data: (catalog) {
                  final restaurants = _filterRestaurants(catalog.restaurants);
                  final products = _filterProducts(catalog.products);
                  final groupedProducts = <String, List<MenuItemSummary>>{};

                  for (final product in catalog.products) {
                    groupedProducts.putIfAbsent(product.restaurantId, () => []);
                    groupedProducts[product.restaurantId]!.add(product);
                  }

                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Kampanyalar',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          height: 150,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _campaignImages.length,
                            separatorBuilder: (_, __) => const SizedBox(width: 12),
                            itemBuilder: (context, index) {
                              return _CampaignCard(imageUrl: _campaignImages[index]);
                            },
                          ),
                        ),
                        const SizedBox(height: 28),
                        Text(
                          _query.isEmpty ? 'Öne Çıkan Ürünler' : 'Ürün Sonuçları',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _query.isEmpty
                              ? 'Restoranların menülerinden seçilen ürünler'
                              : '${products.length} ürün bulundu',
                          style: const TextStyle(color: Colors.white60),
                        ),
                        const SizedBox(height: 14),
                        if (products.isEmpty)
                          const _InlineEmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'Ürün bulunamadı',
                            subtitle:
                                'Arama kelimeni değiştir veya restoranları keşfetmeye devam et.',
                          )
                        else
                          SizedBox(
                            height: 270,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: products.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 14),
                              itemBuilder: (context, index) {
                                final product = products[index];
                                return _ProductCard(
                                  product: product,
                                  onTap: () => _showProductSheet(product),
                                );
                              },
                            ),
                          ),
                        const SizedBox(height: 28),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _query.isEmpty
                                    ? 'Restoranlar'
                                    : 'Restoran Sonuçları',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w900,
                                    ),
                              ),
                            ),
                            Text(
                              '${restaurants.length} sonuç',
                              style: const TextStyle(color: Colors.white60),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _query.isEmpty
                              ? 'Siparişe uygun restoranları keşfet'
                              : 'Aramana eşleşen restoranlar',
                          style: const TextStyle(color: Colors.white60),
                        ),
                        const SizedBox(height: 14),
                        if (restaurants.isEmpty)
                          const _InlineEmptyState(
                            icon: Icons.storefront_outlined,
                            title: 'Bu aramada restoran yok',
                            subtitle:
                                'Farklı bir ürün, kategori veya restoran adı deneyebilirsin.',
                          )
                        else
                          ...restaurants.map((restaurant) {
                            final restaurantProducts =
                                groupedProducts[restaurant.id] ?? const [];

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: _RestaurantCard(
                                restaurant: restaurant,
                                productCount: restaurantProducts.length,
                                onTap: () => _showRestaurantSheet(
                                  restaurant,
                                  restaurantProducts,
                                ),
                                onOrderTap: _requestOrderFlow,
                              ),
                            );
                          }),
                      ],
                    ),
                  );
                },
                loading: () => const Padding(
                  padding: EdgeInsets.fromLTRB(16, 8, 16, 110),
                  child: _LoadingState(),
                ),
                error: (error, _) => Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: _DashboardColors.card,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.cloud_off_rounded,
                          color: Colors.white70,
                          size: 46,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Restoranlar ve ürünler yüklenemedi',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          error.toString(),
                          style: const TextStyle(color: Colors.white60),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: () => ref.invalidate(customerCatalogProvider),
                          style: FilledButton.styleFrom(
                            backgroundColor: _DashboardColors.primary,
                            foregroundColor: Colors.white,
                          ),
                          child: const Text('Tekrar dene'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _BottomNavigationBar(
        sessionExists: session != null,
        onLoginTap: () => context.push(AppRouter.login),
      ),
    );
  }
}

class _BottomNavigationBar extends StatelessWidget {
  const _BottomNavigationBar({
    required this.sessionExists,
    required this.onLoginTap,
  });

  final bool sessionExists;
  final VoidCallback onLoginTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 18),
      decoration: const BoxDecoration(
        color: _DashboardColors.card,
        border: Border(top: BorderSide(color: Colors.white10)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            const _BottomNavItem(
              icon: Icons.home_rounded,
              label: 'Anasayfa',
              active: true,
            ),
            const _BottomNavItem(
              icon: Icons.search_rounded,
              label: 'Ara',
            ),
            _BottomNavItem(
              icon: Icons.shopping_bag_outlined,
              label: 'Siparişler',
              onTap: () => context.push(AppRouter.orders),
            ),
            _BottomNavItem(
              icon: Icons.person_outline_rounded,
              label: 'Profil',
              onTap: () => sessionExists
                  ? context.push(AppRouter.profile)
                  : onLoginTap(),
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomNavItem extends StatelessWidget {
  const _BottomNavItem({
    required this.icon,
    required this.label,
    this.active = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color =
        active ? _DashboardColors.primary : const Color(0xFFB9A5A1);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: SizedBox(
        width: 260,
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => Container(
            color: _DashboardColors.surface,
            child: const Icon(
              Icons.broken_image_outlined,
              color: Colors.white38,
              size: 40,
            ),
          ),
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.onTap,
  });

  final MenuItemSummary product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 208,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            decoration: BoxDecoration(
              color: _DashboardColors.card,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white10),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      height: 116,
                      width: double.infinity,
                      child: product.imageUrl == null || product.imageUrl!.isEmpty
                          ? Container(
                              color: _DashboardColors.surface,
                              child: const Icon(
                                Icons.fastfood_rounded,
                                color: Colors.white38,
                                size: 42,
                              ),
                            )
                          : CachedNetworkImage(
                              imageUrl: product.imageUrl!,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => Container(
                                color: _DashboardColors.surface,
                                child: const Icon(
                                  Icons.broken_image_outlined,
                                  color: Colors.white38,
                                ),
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _TagChip(label: product.category),
                  const SizedBox(height: 10),
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    product.restaurantName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white60,
                      fontSize: 12,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      Text(
                        '₺${product.price.toStringAsFixed(0)}',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        color: _DashboardColors.primarySoft,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  const _RestaurantCard({
    required this.restaurant,
    required this.productCount,
    required this.onTap,
    required this.onOrderTap,
  });

  final RestaurantSummary restaurant;
  final int productCount;
  final VoidCallback onTap;
  final VoidCallback onOrderTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          decoration: BoxDecoration(
            color: _DashboardColors.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white10),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _RoundedNetworkImage(
                  imageUrl: restaurant.logoUrl,
                  width: 92,
                  height: 92,
                  icon: Icons.restaurant_rounded,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              restaurant.name,
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ),
                          _StatusPill(isOpen: restaurant.isOpen),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        restaurant.description.isEmpty
                            ? restaurant.address
                            : restaurant.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white70,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        restaurant.address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _TagChip(label: '$productCount ürün'),
                          const Spacer(),
                          FilledButton.tonal(
                            onPressed: restaurant.isOpen ? onOrderTap : null,
                            style: FilledButton.styleFrom(
                              backgroundColor: _DashboardColors.surface,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Sipariş Ver'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundedNetworkImage extends StatelessWidget {
  const _RoundedNetworkImage({
    required this.imageUrl,
    required this.width,
    required this.height,
    required this.icon,
  });

  final String? imageUrl;
  final double width;
  final double height;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: SizedBox(
        width: width,
        height: height,
        child: imageUrl == null || imageUrl!.isEmpty
            ? Container(
                color: _DashboardColors.surface,
                child: Icon(icon, color: Colors.white38, size: 34),
              )
            : CachedNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  color: _DashboardColors.surface,
                  child: const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white38,
                  ),
                ),
              ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.isOpen});

  final bool isOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isOpen
            ? const Color(0xFF173726)
            : const Color(0xFF4A2424),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        isOpen ? 'Açık' : 'Kapalı',
        style: TextStyle(
          color: isOpen ? const Color(0xFF8BE8B0) : const Color(0xFFFFB3B3),
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? _DashboardColors.primary : _DashboardColors.surface,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: Colors.white,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _DashboardColors.surface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _HomeTab extends StatelessWidget {
  const _HomeTab({
    required this.icon,
    required this.label,
    this.isActive = false,
  });

  final IconData icon;
  final String label;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isActive ? _DashboardColors.surface : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? _DashboardColors.primary : Colors.white10,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 18,
            color: isActive ? _DashboardColors.primarySoft : Colors.white54,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: isActive ? Colors.white : Colors.white60,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineEmptyState extends StatelessWidget {
  const _InlineEmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: _DashboardColors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Icon(icon, color: Colors.white38, size: 42),
          const SizedBox(height: 14),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(color: Colors.white60, height: 1.4),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(
        4,
        (index) => Container(
          margin: const EdgeInsets.only(bottom: 14),
          height: index == 0 ? 150 : 120,
          decoration: BoxDecoration(
            color: _DashboardColors.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white10),
          ),
        ),
      ),
    );
  }
}

abstract final class _DashboardColors {
  static const background = Color(0xFF170C0C);
  static const card = Color(0xFF251414);
  static const surface = Color(0xFF341E1E);
  static const primary = Color(0xFFFF5D66);
  static const primarySoft = Color(0xFFFFA8AA);
  static const topBanner = Color(0xFF820001);
}
