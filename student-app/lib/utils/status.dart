import '../models/models.dart';
import '../providers/bus_provider.dart';
import '../widgets/common.dart';

(String, Level) phaseLabel(BusProvider p) {
  switch (p.phase) {
    case BusPhase.onRoute:
      return ('ON ROUTE', Level.good);
    case BusPhase.stopped:
      return ('STOPPED', Level.warn);
    case BusPhase.atStop:
      return ('AT ${(p.atStopName ?? 'STOP').toUpperCase()}', Level.good);
    case BusPhase.gpsWeak:
      return ('GPS WEAK', Level.warn);
    case BusPhase.offline:
      return ('OFFLINE', Level.bad);
    case BusPhase.completed:
      return (p.direction == fromCollege ? 'TRIP COMPLETED' : 'REACHED COLLEGE', Level.good);
    case BusPhase.notStarted:
      return ('NOT STARTED', Level.warn);
  }
}

(String, Level) liveLabel(LiveState s) => switch (s) {
      LiveState.live => ('Live', Level.good),
      LiveState.updating => ('Updating', Level.warn),
      LiveState.offline => ('Offline', Level.bad),
    };
