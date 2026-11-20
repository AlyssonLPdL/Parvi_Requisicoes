'use strict';

/**
 * Normaliza veículo: mantém apenas dígitos.
 * Ex: "322240 - QZX5G36" -> "322240"
 */
function normalizarVeiculo(v) {
  if (v == null) return '';
  return String(v).replace(/\D/g, '');
}