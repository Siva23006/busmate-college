// Replaces the default counter test created by `flutter create`.
import 'package:busmate_driver/models/models.dart';
import 'package:busmate_driver/theme/app_theme.dart';
import 'package:busmate_driver/utils/accuracy.dart';
import 'package:busmate_driver/utils/format.dart';
import 'package:busmate_driver/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('GPS accuracy bands follow the spec', () {
    expect(accuracyLevel(8), AccuracyLevel.excellent);
    expect(accuracyLevel(25), AccuracyLevel.good);
    expect(accuracyLevel(42), AccuracyLevel.fair);
    expect(accuracyLevel(150), AccuracyLevel.poor);
    expect(accuracyLabel(8), '±8 m · Excellent');
  });

  test('formatting', () {
    expect(durationText(const Duration(minutes: 5, seconds: 7)), '05:07');
    expect(distanceText(1530), '1.5 km');
  });

  test('trip direction: pre-selected by time, stops reversed for the evening run', () {
    expect(directionForTime(DateTime(2026, 10, 7, 7, 30)), toCollege);
    expect(directionForTime(DateTime(2026, 10, 7, 16, 0)), fromCollege);
    final route = RouteInfo.fromJson({
      'id': 1,
      'route_name': 'R',
      'start_location': 'Town',
      'destination': 'College',
      'path': [
        [13.0, 80.0],
        [13.1, 80.1],
      ],
      'stops': [
        {'id': 2, 'stop_name': 'College', 'stop_order': 2, 'latitude': 13.1, 'longitude': 80.1},
        {'id': 1, 'stop_name': 'Town', 'stop_order': 1, 'latitude': 13.0, 'longitude': 80.0},
      ],
    });
    expect(route.stopsFor(toCollege).map((s) => s.name), ['Town', 'College']);
    expect(route.stopsFor(fromCollege).map((s) => s.name), ['College', 'Town']);
    expect(route.startFor(fromCollege), 'College');
    expect(route.destinationFor(fromCollege), 'Town');
    expect(route.path!.length, 2);
    expect(Trip.fromJson({'id': 1, 'bus_id': 1, 'direction': 'FROM_COLLEGE', 'stops_reached': 3}).direction, fromCollege);
  });

  testWidgets('direction selector switches between the two runs', (tester) async {
    var value = toCollege;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: StatefulBuilder(builder: (context, setState) => DirectionSelector(value: value, onChanged: (d) => setState(() => value = d)))),
    ));
    expect(find.text('MORNING'), findsOneWidget);
    expect(find.text('From College'), findsOneWidget);
    await tester.tap(find.text('EVENING'));
    await tester.pumpAndSettle();
    expect(value, fromCollege);
  });

  testWidgets('END TRIP needs a long press: a tap does nothing, holding confirms', (tester) async {
    var confirmed = 0;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(body: Center(child: HoldButton(label: 'HOLD TO END TRIP', icon: Icons.stop_rounded, onConfirmed: () => confirmed++))),
    ));
    await tester.tap(find.text('HOLD TO END TRIP'));
    await tester.pumpAndSettle();
    expect(confirmed, 0);

    final gesture = await tester.startGesture(tester.getCenter(find.text('HOLD TO END TRIP')));
    await tester.pump(const Duration(milliseconds: 200)); // press registered, fill starts
    await tester.pump(const Duration(milliseconds: 600));
    expect(confirmed, 0); // not held long enough yet
    await tester.pump(const Duration(milliseconds: 900));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(confirmed, 1);
  });
}
