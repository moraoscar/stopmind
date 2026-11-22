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
import { useGame } from '../context/GameContext';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SPACING,
} from '../theme/tokens';
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
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  headerSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    fontWeight: FONT_WEIGHTS.semibold,
    marginTop: 2,
  },
  letterPill: {
    width: 44,
    height: 44,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterPillText: {
    fontSize: FONT_SIZES.h3,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.white,
  },
  scrollContent: {
    padding: SPACING.xl,
    gap: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  winnerBanner: {
    backgroundColor: COLORS.ink,
    borderRadius: RADII.modal,
    padding: SPACING.xxl + 2,
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  winnerEyebrow: {
    color: COLORS.trophyGold,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.extrabold,
    letterSpacing: LETTER_SPACING.wider,
    marginTop: SPACING.xxs,
  },
  winnerName: {
    color: COLORS.white,
    fontSize: FONT_SIZES.h1,
    fontWeight: FONT_WEIGHTS.black,
  },
  winnerPoints: {
    color: COLORS.mintHighlight,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  scoreHero: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    padding: SPACING.xl + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  scoreDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
  },
  scoreLabel: {
    fontSize: FONT_SIZES.xxs,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.inkMuted,
    letterSpacing: LETTER_SPACING.normal,
  },
  scoreBig: {
    fontSize: FONT_SIZES.hero,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.emerald,
    fontVariant: ['tabular-nums'],
  },
  hintPenaltyNote: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.amberDark,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    padding: SPACING.md,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.bg,
  },
  rankRowMe: {
    backgroundColor: COLORS.indigoSoft,
    borderWidth: 1,
    borderColor: COLORS.indigoBorder,
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
    backgroundColor: COLORS.medalGold,
  },
  rankSecond: {
    backgroundColor: COLORS.medalSilver,
  },
  rankThird: {
    backgroundColor: COLORS.medalBronze,
  },
  rankNumText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  rankNumTextMedal: {
    color: COLORS.white,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  rankRoundGain: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  rankTotal: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  legendPill: {
    paddingHorizontal: SPACING.md - 1,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.pill,
  },
  legendText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  catResultBlock: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.xl,
    padding: SPACING.base,
    gap: SPACING.xs,
  },
  catResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catResultTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  ptsBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.pill,
  },
  ptsBadgeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.black,
  },
  pts100Bg: {
    backgroundColor: COLORS.emeraldSoft,
  },
  pts100Text: {
    color: COLORS.emeraldDark,
  },
  pts50Bg: {
    backgroundColor: COLORS.amberSoft,
  },
  pts50Text: {
    color: COLORS.amberDark,
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
    gap: SPACING.sm,
  },
  myWordText: {
    fontSize: FONT_SIZES.lg + 1,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
    flex: 1,
  },
  emptyWordText: {
    color: COLORS.slate,
    fontStyle: 'italic',
    fontWeight: FONT_WEIGHTS.regular,
  },
  reasonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.inkMuted,
  },
  othersList: {
    marginTop: SPACING.xxs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xxs,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  otherName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.inkMuted,
  },
  otherWord: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.ink,
  },
  otherPts: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  finalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  flexBtn: {
    flex: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg + 1,
    paddingHorizontal: SPACING.xl + 2,
    borderRadius: RADII.xl,
  },
  primaryBtnPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.normal,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.lg + 1,
    paddingHorizontal: SPACING.xl + 2,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: {
    color: COLORS.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  guestWaitBar: {
    backgroundColor: COLORS.indigoSoft,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADII.xl,
    alignItems: 'center',
  },
  guestWaitText: {
    color: COLORS.indigo,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.bold,
    textAlign: 'center',
  },
});
