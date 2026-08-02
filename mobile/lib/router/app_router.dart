import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/address/presentation/address_picker_page.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/checkout/presentation/checkout_page.dart';
import '../features/courier/presentation/courier_panel_page.dart';
import '../features/customer/presentation/customer_home_page.dart';
import '../features/orders/presentation/orders_page.dart';
import '../features/profile/presentation/profile_page.dart';
import '../features/restaurant/domain/restaurant_detail_bundle.dart';
import '../features/restaurant/presentation/restaurant_detail_page.dart';
import '../features/restaurant/presentation/restaurant_panel_page.dart';
import '../features/support/presentation/help_center_page.dart';
import '../features/tracking/presentation/tracking_page.dart';
import '../features/wallet/presentation/wallet_page.dart';

abstract final class AppRouter {
  static const login = '/login';
  static const customerHome = '/customer';
  static const restaurantDetailPath = '/restaurants/:id';
  static const orders = '/orders';
  static const profile = '/profile';
  static const checkout = '/checkout';
  static const wallet = '/wallet';
  static const addressPicker = '/address-picker';
  static const helpCenter = '/help';
  static const trackingPath = '/tracking/:orderId';
  static const courierPanel = '/courier';
  static const restaurantPanel = '/restaurant-panel';

  static String restaurantDetail(String id) => '/restaurants/$id';
  static String tracking(String orderId) => '/tracking/$orderId';
}

final routerRefreshProvider = Provider<RouterRefreshNotifier>((ref) {
  final notifier = RouterRefreshNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final goRouterProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = ref.watch(routerRefreshProvider);

  return GoRouter(
    initialLocation: AppRouter.customerHome,
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final session = authState.valueOrNull;
      final isAuthenticated = session != null;
      final isLoginPage = state.matchedLocation == AppRouter.login;
      final isProtectedPage =
          state.matchedLocation == AppRouter.orders ||
          state.matchedLocation == AppRouter.profile ||
          state.matchedLocation == AppRouter.checkout ||
          state.matchedLocation == AppRouter.wallet ||
          state.matchedLocation == AppRouter.helpCenter ||
          state.matchedLocation == AppRouter.addressPicker ||
          state.matchedLocation == AppRouter.courierPanel ||
          state.matchedLocation == AppRouter.restaurantPanel ||
          state.matchedLocation.startsWith('/tracking/');

      if (authState.isLoading) {
        return null;
      }

      if (!isAuthenticated && isProtectedPage) {
        return AppRouter.login;
      }

      if (isAuthenticated) {
        final isCustomerHome = state.matchedLocation == AppRouter.customerHome;
        final role = session.user.role.toLowerCase();
        
        final defaultHome = role == 'customer' 
            ? AppRouter.customerHome 
            : (role == 'restaurant' ? AppRouter.restaurantPanel : AppRouter.courierPanel);

        if (isLoginPage) {
          return defaultHome;
        }

        if (isCustomerHome && role != 'customer') {
          return defaultHome;
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRouter.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRouter.customerHome,
        builder: (context, state) => const CustomerHomePage(),
      ),
      GoRoute(
        path: AppRouter.restaurantDetailPath,
        builder: (context, state) {
          final bundle = state.extra as RestaurantDetailBundle?;
          if (bundle == null) {
            return const Scaffold(
              body: Center(
                child: Text('Restoran detay verisi bulunamadı.'),
              ),
            );
          }
          return RestaurantDetailPage(bundle: bundle);
        },
      ),
      GoRoute(
        path: AppRouter.orders,
        builder: (context, state) => const OrdersPage(),
      ),
      GoRoute(
        path: AppRouter.profile,
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: AppRouter.checkout,
        builder: (context, state) => const CheckoutPage(),
      ),
      GoRoute(
        path: AppRouter.wallet,
        builder: (context, state) => const WalletPage(),
      ),
      GoRoute(
        path: AppRouter.addressPicker,
        builder: (context, state) => const AddressPickerPage(),
      ),
      GoRoute(
        path: AppRouter.helpCenter,
        builder: (context, state) => const HelpCenterPage(),
      ),
      GoRoute(
        path: AppRouter.trackingPath,
        builder: (context, state) => TrackingPage(
          orderId: state.pathParameters['orderId'],
        ),
      ),
      GoRoute(
        path: AppRouter.courierPanel,
        builder: (context, state) => const CourierPanelPage(),
      ),
      GoRoute(
        path: AppRouter.restaurantPanel,
        builder: (context, state) => const RestaurantPanelPage(),
      ),
    ],
  );
});

class RouterRefreshNotifier extends ChangeNotifier {
  RouterRefreshNotifier(this.ref) {
    _sub = ref.listen<AsyncValue<dynamic>>(
      authControllerProvider,
      (_, __) => notifyListeners(),
      fireImmediately: false,
    );
  }

  final Ref ref;
  ProviderSubscription<AsyncValue<dynamic>>? _sub;

  @override
  void dispose() {
    _sub?.close();
    super.dispose();
  }
}
