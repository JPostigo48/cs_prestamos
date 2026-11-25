import { describe, expect, it } from 'vitest';
import {
  absolveEpisodeCalendar,
  extendEpisodeCalendar,
  type CalendarEntry,
} from '../src/modules/rules/domain/episode-calendar.js';
import { appealRestitution } from '../src/modules/rules/domain/episode-adjustment.js';

const base = Date.parse('2026-11-01T12:00:00.123Z');
const day = 86_400_000;
const at = (days: number) => new Date(base + days * day);
const entry = (
  id: string,
  start: number,
  end: number | null,
  status: CalendarEntry['status'] = 'ACTIVA',
): CalendarEntry => ({
  id,
  startsAt: at(start),
  endsAt: end === null ? null : at(end),
  status,
});

describe('calendario puro de episodios', () => {
  it('amplía vigente solo por diferencia y desplaza siguientes conservando duraciones e indefinidas', () => {
    const initial = [
      entry('a', 0, 7),
      entry('b', 7, 12, 'PROGRAMADA'),
      entry('c', 12, 14, 'PROGRAMADA'),
      entry('loss', 0, null),
    ];
    const result = extendEpisodeCalendar(initial, 'a', 8, at(1));
    expect(result).toContainEqual(entry('a', 0, 15));
    expect(result).toContainEqual(entry('b', 15, 20, 'PROGRAMADA'));
    expect(result).toContainEqual(entry('c', 20, 22, 'PROGRAMADA'));
    expect(result).toContainEqual(initial[3]);
    expect(initial[0]!.endsAt).toEqual(at(7));
  });

  it('amplía programada sin consumir sus días antes de comenzar', () => {
    const result = extendEpisodeCalendar(
      [
        entry('a', 0, 7),
        entry('b', 7, 14, 'PROGRAMADA'),
        entry('c', 14, 20, 'PROGRAMADA'),
      ],
      'b',
      7,
      at(1),
    );
    expect(result).toEqual([
      entry('a', 0, 7),
      entry('b', 7, 21, 'PROGRAMADA'),
      entry('c', 21, 27, 'PROGRAMADA'),
    ]);
  });

  it.each(['ACTIVA', 'FINALIZADA'] as const)(
    'si terminó (%s), añade solo la diferencia al final de la cola',
    (status) => {
      const result = extendEpisodeCalendar(
        [
          entry('a', 0, 7, status),
          entry('b', 7, 10),
          entry('c', 10, 20, 'PROGRAMADA'),
        ],
        'a',
        8,
        at(9),
      );
      expect(result).toContainEqual(entry('a', 20, 28, 'PROGRAMADA'));
      expect(result).toContainEqual(entry('b', 7, 10));
      expect(result).toContainEqual(entry('c', 10, 20, 'PROGRAMADA'));
    },
  );

  it('exactamente al fin no vuelve a consumir el tramo cumplido', () => {
    expect(extendEpisodeCalendar([entry('a', 0, 7)], 'a', 8, at(7))).toEqual([
      entry('a', 7, 15),
    ]);
  });

  it('bloqueo indefinido inmediato coexiste sin pausar días temporales', () => {
    expect(
      extendEpisodeCalendar(
        [entry('a', 0, 7), entry('b', 7, 9, 'PROGRAMADA')],
        'loss',
        null,
        at(2),
      ),
    ).toEqual([
      entry('a', 0, 7),
      entry('b', 7, 9, 'PROGRAMADA'),
      entry('loss', 2, null),
    ]);
  });

  it('absuelve activa y adelanta desde resolución, sin devolver días transcurridos', () => {
    const result = absolveEpisodeCalendar(
      [
        entry('a', 0, 7),
        entry('b', 7, 12, 'PROGRAMADA'),
        entry('c', 12, 14, 'PROGRAMADA'),
      ],
      'a',
      at(3),
    );
    expect(result).toEqual([
      entry('a', 0, 7, 'ABSUELTA'),
      entry('b', 3, 8),
      entry('c', 8, 10, 'PROGRAMADA'),
    ]);
  });

  it('absuelve programada conservando la temporal activa anterior', () => {
    expect(
      absolveEpisodeCalendar(
        [
          entry('a', 0, 7),
          entry('b', 7, 12, 'PROGRAMADA'),
          entry('c', 12, 14, 'PROGRAMADA'),
        ],
        'b',
        at(3),
      ),
    ).toEqual([
      entry('a', 0, 7),
      entry('b', 7, 12, 'ABSUELTA'),
      entry('c', 7, 9, 'PROGRAMADA'),
    ]);
  });

  it('absuelve indefinida/finalizada sin acortar otras sanciones', () => {
    const initial = [
      entry('a', 0, 7),
      entry('b', 7, 12, 'PROGRAMADA'),
      entry('loss', 1, null),
    ];
    const after = absolveEpisodeCalendar(initial, 'loss', at(3));
    expect(after).toContainEqual(initial[0]);
    expect(after).toContainEqual(initial[1]);
    expect(after).toContainEqual(entry('loss', 1, null, 'ABSUELTA'));
    expect(absolveEpisodeCalendar(initial, 'a', at(8))).toContainEqual(
      initial[1],
    );
  });

  it('una absuelta no se reactiva ni se extiende', () => {
    const initial = [entry('a', 0, 7, 'ABSUELTA')];
    expect(extendEpisodeCalendar(initial, 'a', 100, at(8))).toEqual(initial);
    expect(extendEpisodeCalendar(initial, 'a', null, at(8))).toEqual(initial);
  });

  it('valida días y rango de fechas', () => {
    expect(() => extendEpisodeCalendar([], 'a', -1, at(0))).toThrow(RangeError);
    expect(() => extendEpisodeCalendar([], 'a', 0.5, at(0))).toThrow(
      RangeError,
    );
    expect(() =>
      extendEpisodeCalendar([], 'a', Number.MAX_SAFE_INTEGER, at(0)),
    ).toThrow(RangeError);
  });
});

describe('restitución efectiva y compatibilidad legado', () => {
  it('suma ajustes, no agrega de nuevo el inicial ni cobra truncamientos', () => {
    expect(appealRestitution(60, [5, 10, 10], 5, 0)).toEqual({
      deducted: 25,
      resultingBalance: 85,
    });
    expect(appealRestitution(95, [5, 10, 10], 5, 0)).toEqual({
      deducted: 25,
      resultingBalance: 100,
    });
  });
  it('cero efectivo con ajustes no usa la diferencia legado', () => {
    expect(appealRestitution(30, [0], 80, 0)).toEqual({
      deducted: 0,
      resultingBalance: 30,
    });
  });
  it('legado sin ajustes conserva la diferencia de saldos original', () => {
    expect(appealRestitution(55, [], 60, 45)).toEqual({
      deducted: 15,
      resultingBalance: 70,
    });
  });
});
