import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'config.dart';

/// Error with a message that is safe to show to the student.
class ApiException implements Exception {
  ApiException(this.message, {this.status = 0, this.code = 'ERROR'});
  final String message;
  final int status;
  final String code;
  bool get isAuthError => status == 401;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({this.onUnauthorized});

  String? token;
  final void Function()? onUnauthorized;

  Future<Map<String, dynamic>> get(String path) => _send('GET', path);
  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body);
  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) => _send('PUT', path, body);
  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) => _send('PATCH', path, body);

  Future<Map<String, dynamic>> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('${AppConfig.apiUrl}/api$path');
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
    http.Response res;
    try {
      final req = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 60))); // free Render backend can take ~1 min to wake up
    } on TimeoutException {
      throw ApiException('The server is taking too long. Check your internet and try again.', code: 'TIMEOUT');
    } on SocketException {
      throw ApiException('Cannot reach BusMate server. Check your internet connection.', code: 'NETWORK');
    } on http.ClientException {
      throw ApiException('Cannot reach BusMate server. Check your internet connection.', code: 'NETWORK');
    }

    Map<String, dynamic> json = {};
    if (res.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) json = decoded;
      } catch (_) {/* non-JSON body */}
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return json;

    final err = (json['error'] as Map<String, dynamic>?) ?? {};
    if (res.statusCode == 401 && !path.startsWith('/auth/login')) onUnauthorized?.call();
    throw ApiException(
      (err['message'] as String?) ?? 'Request failed (${res.statusCode}).',
      status: res.statusCode,
      code: (err['code'] as String?) ?? 'ERROR',
    );
  }
}
