import test from 'node:test';
import assert from 'node:assert/strict';
import { areWordsSimilar, scoreRoundLocal } from '@stopmind/shared';

test('Distinct Spanish surnames, names, and words are NEVER marked as duplicates', () => {
  const distinctPairs: [string, string][] = [
    ['Frías', 'Farías'],
    ['Frias', 'Farias'],
    ['María', 'Mario'],
    ['Camila', 'Camilo'],
    ['Daniel', 'Daniela'],
    ['Sofía', 'Sonia'],
    ['Rojas', 'Rosas'],
    ['Pérez', 'Páez'],
    ['Panamá', 'Paraná'],
    ['Austria', 'Australia'],
    ['Perro', 'Pero'],
    ['Carro', 'Caro'],
    ['Pato', 'Gato'],
    ['Cabra', 'Cobra'],
    ['Castro', 'Castor'],
  ];

  for (const [a, b] of distinctPairs) {
    assert.equal(
      areWordsSimilar(a, b),
      false,
      `Expected "${a}" and "${b}" to be distinct`
    );
  }
});

test('True duplicates, accents, phonetic twins, and long-word transpositions ARE marked as duplicates', () => {
  const duplicatePairs: [string, string][] = [
    ['Frías', 'Frias'],
    ['Farías', 'farias'],
    ['México', 'Mexico'],
    ['Gómez', 'Gomes'],
    ['Sánchez', 'Sanches'],
    ['Jirafa', 'Girafa'],
    ['Ballena', 'Bayena'],
    ['Zanahoria', 'Sanaoria'],
    ['Vaca', 'Baca'],
    ['Helado', 'Elado'],
    ['Manzana', 'Manazna'],
    ['Colombia', 'Colomiba'],
  ];

  for (const [a, b] of duplicatePairs) {
    assert.equal(
      areWordsSimilar(a, b),
      true,
      `Expected "${a}" and "${b}" to be treated as duplicates`
    );
  }
});

test('scoreRoundLocal awards 100 pts each for Frias and Farias under Apellido (F)', () => {
  const { categoryResults, roundScores } = scoreRoundLocal({
    categories: ['Apellido'],
    letter: 'F',
    validateLetter: true,
    players: [
      { id: 'p1', name: 'Oscar' },
      { id: 'p2', name: 'Ana' },
    ],
    answersByPlayer: {
      p1: { Apellido: 'Frias' },
      p2: { Apellido: 'Farias' },
    },
  });

  assert.equal(roundScores.p1, 100);
  assert.equal(roundScores.p2, 100);
  assert.equal(categoryResults[0]?.entries[0]?.reason, 'unique');
  assert.equal(categoryResults[0]?.entries[1]?.reason, 'unique');
});
