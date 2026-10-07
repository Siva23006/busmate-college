enum AccuracyLevel { excellent, good, fair, poor, unknown }

/// Spec section 10 bands: 0-10 EXCELLENT, 10-30 GOOD, 30-100 FAIR, >100 POOR.
AccuracyLevel accuracyLevel(double? meters) {
  if (meters == null || meters.isNaN) return AccuracyLevel.unknown;
  if (meters <= 10) return AccuracyLevel.excellent;
  if (meters <= 30) return AccuracyLevel.good;
  if (meters <= 100) return AccuracyLevel.fair;
  return AccuracyLevel.poor;
}

String accuracyLabel(double? meters) {
  switch (accuracyLevel(meters)) {
    case AccuracyLevel.excellent:
      return '±${meters!.round()} m · Excellent';
    case AccuracyLevel.good:
      return '±${meters!.round()} m · Good';
    case AccuracyLevel.fair:
      return '±${meters!.round()} m · Fair';
    case AccuracyLevel.poor:
      return 'Poor (±${meters!.round()} m)';
    case AccuracyLevel.unknown:
      return '-';
  }
}
