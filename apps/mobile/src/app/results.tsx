import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/game';
import { useGame } from '../context/GameContext';
import { ScoreReason } from '../types/game';

function getReasonLabel(
  reason: ScoreReason,
  matchedWith: string[],
  letter: string,
  invalidDetail?: string
): string {
  switch (reason) {
    case 'unique':
      return 'Palabra única';
    case 'duplicate':
      return matchedWith.length > 0
        ? `Repetida con ${matchedWith.join(', ')}`
        : 'Palabra repetida';
    case 'wrong_letter':
      return `No empieza con "${letter}"`;
    case 'invalid':
      return invalidDetail || 'Palabra no válida';
    case 'empty':
    default:
      return 'Sin respuesta';
  }
}

export default function ResultsScreen() {
  const {
    roundResults,
    playerId,
    isHost,
    nextRound,
    playAgain,
    leaveGame,
  } = useGame();

  if (!roundResults) {
    return null;
  }

  const myLeaderboardEntry =
    roundResults.leaderboard.find((e) => e.playerId === playerId) ??
    roundResults.leaderboard[0];

  const myRoundScore = myLeaderboardEntry?.roundScore ?? 0;
  const myTotalScore = myLeaderboardEntry?.totalScore ?? 0;
  const winner = roundResults.leaderboard[0];
  const isMultiplayer = roundResults.leaderboard.length > 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {roundResults.isFinalRound
              ? 'Resultados Finales'
              : `Fin de Ronda ${roundResults.roundNumber} de ${roundResults.totalRounds}`}
          </Text>
          <Text style={styles.headerSub}>
            Letra {roundResults.letter} ·{' '}
            {roundResults.stopReason === 'stop' && roundResults.stoppedByName
              ? `STOP por ${roundResults.stoppedByName}`
              : 'Tiempo terminado'}
            {roundResults.validatedBy === 'gemini'
              ? ' · ✨ IA Gemini'
              : ' · Revisión local'}
          </Text>
        </View>
        <View style={styles.letterPill}>
          <Text style={styles.letterPillText}>{roundResults.letter}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Final Winner Celebration */}
        {roundResults.isFinalRound && winner && (
          <View style={styles.winnerBanner}>
            <Ionicons name="trophy" size={34} color="#FDE047" />
            <Text style={styles.winnerEyebrow}>
              {isMultiplayer ? 'GANADOR DE LA PARTIDA' : 'PARTIDA COMPLETADA'}
            </Text>
            <Text style={styles.winnerName}>{winner.playerName}</Text>
            <Text style={styles.winnerPoints}>{winner.totalScore} puntos</Text>
          </View>
        )}

        {/* Your Score Summary Card */}
        <View style={styles.scoreHero}>
          <View style={styles.scoreCol}>
            <Text style={styles.scoreLabel}>PUNTOS EN ESTA RONDA</Text>
            <Text style={styles.scoreBig}>+{myRoundScore}</Text>
            {(myLeaderboardEntry?.hintPenalty ?? 0) > 0 && (
              <Text style={styles.hintPenaltyNote}>
                💡 {myLeaderboardEntry?.hintsUsed} ayuda
                {myLeaderboardEntry?.hintsUsed === 1 ? '' : 's'} (−
                {myLeaderboardEntry?.hintPenalty} pts)
              </Text>
            )}
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreCol}>
            <Text style={styles.scoreLabel}>PUNTAJE TOTAL</Text>
            <Text style={[styles.scoreBig, { color: COLORS.indigo }]}>
              {myTotalScore}
            </Text>
          </View>
        </View>

        {/* Leaderboard (multiplayer or final summary) */}
        {(isMultiplayer || roundResults.isFinalRound) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="podium" size={18} color={COLORS.amber} />
              <Text style={styles.sectionTitle}>Tabla de posiciones</Text>
            </View>
            {roundResults.leaderboard.map((entry, idx) => {
              const isMe = entry.playerId === playerId;
              return (
                <View
                  key={entry.playerId}
                  style={[styles.rankRow, isMe && styles.rankRowMe]}
                >
                  <View
                    style={[
                      styles.rankNum,
                      idx === 0 && styles.rankFirst,
                      idx === 1 && styles.rankSecond,
                      idx === 2 && styles.rankThird,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankNumText,
                        idx < 3 && styles.rankNumTextMedal,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <Text style={styles.rankName}>
                      {entry.playerName}
                      {isMe ? ' (Tú)' : ''}
                    </Text>
                    <Text style={styles.rankRoundGain}>
                      +{entry.roundScore} pts esta ronda
                      {(entry.hintPenalty ?? 0) > 0
                        ? ` (💡 −${entry.hintPenalty} pts)`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.rankTotal}>{entry.totalScore} pts</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Per-Category Breakdown */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-circle" size={19} color={COLORS.indigo} />
            <Text style={styles.sectionTitle}>Detalle por categoría</Text>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendPill, styles.pts100Bg]}>
              <Text style={[styles.legendText, styles.pts100Text]}>
                100 única
              </Text>
            </View>
            <View style={[styles.legendPill, styles.pts50Bg]}>
              <Text style={[styles.legendText, styles.pts50Text]}>
                50 repetida
              </Text>
            </View>
            <View style={[styles.legendPill, styles.pts0Bg]}>
              <Text style={[styles.legendText, styles.pts0Text]}>
                0 vacía / inválida
              </Text>
            </View>
          </View>

          {roundResults.categoryResults.map((catRes) => {
            const myEntry =
              catRes.entries.find((e) => e.playerId === playerId) ??
              catRes.entries[0];

            return (
              <View key={catRes.category} style={styles.catResultBlock}>
                <View style={styles.catResultTop}>
                  <Text style={styles.catResultTitle}>{catRes.category}</Text>
                  {myEntry && (
                    <View
                      style={[
                        styles.ptsBadge,
                        myEntry.points === 100
                          ? styles.pts100Bg
                          : myEntry.points === 50
                            ? styles.pts50Bg
                            : myEntry.reason === 'invalid' ||
                                myEntry.reason === 'wrong_letter'
                              ? styles.ptsInvalidBg
                              : styles.pts0Bg,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ptsBadgeText,
                          myEntry.points === 100
                            ? styles.pts100Text
                            : myEntry.points === 50
                              ? styles.pts50Text
                              : myEntry.reason === 'invalid' ||
                                  myEntry.reason === 'wrong_letter'
                                ? styles.ptsInvalidText
                                : styles.pts0Text,
                        ]}
                      >
                        +{myEntry.points} pts
                      </Text>
                    </View>
                  )}
                </View>

                {myEntry && (
                  <View style={styles.myWordRow}>
                    <Text
                      style={[
                        styles.myWordText,
                        !myEntry.word && styles.emptyWordText,
                        myEntry.reason === 'invalid' && styles.invalidWordText,
                      ]}
                    >
                      {myEntry.word || '— (vacío)'}
                    </Text>
                    <Text
                      style={[
                        styles.reasonText,
                        (myEntry.reason === 'invalid' ||
                          myEntry.reason === 'wrong_letter') &&
                          styles.ptsInvalidText,
                      ]}
                    >
                      {getReasonLabel(
                        myEntry.reason,
                        myEntry.matchedWith,
                        roundResults.letter,
                        myEntry.invalidDetail
                      )}
                    </Text>
                  </View>
                )}

                {/* Other players' words in multiplayer */}
                {isMultiplayer && (
                  <View style={styles.othersList}>
                    {catRes.entries
                      .filter((e) => e.playerId !== playerId)
                      .map((other) => (
                        <View key={other.playerId} style={styles.otherRow}>
                          <Text style={styles.otherName}>
                            {other.playerName}:
                          </Text>
                          <Text
                            style={[
                              styles.otherWord,
                              !other.word && styles.emptyWordText,
                            ]}
                            numberOfLines={1}
                          >
                            {other.word || '—'}
                          </Text>
                          <Text
                            style={[
                              styles.otherPts,
                              other.points === 100
                                ? styles.pts100Text
                                : other.points === 50
                                  ? styles.pts50Text
                                  : styles.pts0Text,
                            ]}
                          >
                            +{other.points}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        {!roundResults.isFinalRound ? (
          isHost ? (
            <Pressable
              onPress={nextRound}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                SIGUIENTE RONDA ({roundResults.roundNumber + 1}/
                {roundResults.totalRounds})
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.guestWaitBar}>
              <Text style={styles.guestWaitText}>
                Esperando a que el anfitrión inicie la ronda{' '}
                {roundResults.roundNumber + 1}…
              </Text>
            </View>
          )
        ) : (
          <View style={styles.finalActions}>
            {isHost && (
              <Pressable
                onPress={playAgain}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.flexBtn,
                  pressed && styles.primaryBtnPressed,
                ]}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>JUGAR DE NUEVO</Text>
              </Pressable>
            )}
            <Pressable
              onPress={leaveGame}
              style={[styles.secondaryBtn, !isHost && styles.flexBtn]}
            >
              <Ionicons name="home-outline" size={18} color={COLORS.ink} />
              <Text style={styles.secondaryBtnText}>Inicio</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.ink,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.inkMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  letterPill: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterPillText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  winnerBanner: {
    backgroundColor: COLORS.ink,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 4,
  },
  winnerEyebrow: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  winnerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  winnerPoints: {
    color: '#A7F3D0',
    fontSize: 16,
    fontWeight: '800',
  },
  scoreHero: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  scoreDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.inkMuted,
    letterSpacing: 0.8,
  },
  scoreBig: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.emerald,
    fontVariant: ['tabular-nums'],
  },
  hintPenaltyNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
  },
  rankRowMe: {
    backgroundColor: COLORS.indigoSoft,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  rankNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: {
    backgroundColor: '#F59E0B',
  },
  rankSecond: {
    backgroundColor: '#94A3B8',
  },
  rankThird: {
    backgroundColor: '#B45309',
  },
  rankNumText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.ink,
  },
  rankNumTextMedal: {
    color: '#FFFFFF',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  rankRoundGain: {
    fontSize: 12,
    color: COLORS.inkMuted,
    fontWeight: '600',
  },
  rankTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.ink,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  legendPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '800',
  },
  catResultBlock: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  catResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catResultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ptsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ptsBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  pts100Bg: {
    backgroundColor: COLORS.emeraldSoft,
  },
  pts100Text: {
    color: '#047857',
  },
  pts50Bg: {
    backgroundColor: COLORS.amberSoft,
  },
  pts50Text: {
    color: '#B45309',
  },
  pts0Bg: {
    backgroundColor: COLORS.surfaceAlt,
  },
  pts0Text: {
    color: COLORS.inkMuted,
  },
  ptsInvalidBg: {
    backgroundColor: COLORS.stopRedSoft,
  },
  ptsInvalidText: {
    color: COLORS.stopRedDark,
  },
  invalidWordText: {
    color: COLORS.stopRedDark,
    textDecorationLine: 'line-through',
  },
  myWordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  myWordText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    flex: 1,
  },
  emptyWordText: {
    color: COLORS.slate,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.inkMuted,
  },
  othersList: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otherName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkMuted,
  },
  otherWord: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  otherPts: {
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  finalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.indigo,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  primaryBtnPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  guestWaitBar: {
    backgroundColor: COLORS.indigoSoft,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  guestWaitText: {
    color: COLORS.indigo,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
