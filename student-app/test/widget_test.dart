// Replaces the default counter test created by `flutter create`.
import 'package:busmate_student/models/models.dart';
import 'package:busmate_student/utils/format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a bus:location event with ETA', () {
    final loc = LiveLocation.fromEvent({
      'busId': 1, 'tripId': 9, 'latitude': 13.1, 'longitude': 80.2, 'accuracy': 8,
      'speed': 10, 'heading': 90, 'timestamp': '2026-10-07T08:00:00.000Z', 'isSimulation': true,
    });
    expect(loc.speedKmh, 36);
    expect(loc.isSimulation, true);
    final eta = Eta.fromJson({
      'stops': [
        {'stopId': 1, 'stopName': 'A', 'stopOrder': 1, 'passed': true},
        {'stopId': 2, 'stopName': 'B', 'stopOrder': 2, 'passed': false, 'remainingMeters': 900, 'etaSeconds': 480, 'expectedAt': '2026-10-07T08:08:00.000Z'},
      ],
      'nextStop': {'stopId': 2, 'stopName': 'B', 'stopOrder': 2, 'passed': false, 'etaSeconds': 480},
    })!;
    expect(eta.forStop(2)!.etaSeconds, 480);
    expect(etaText(480), '8 min');
  });
}
