import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { COLORS, FONT_SIZES, RADII, SPACING } from '../theme/tokens';
import { generateCorrelationId, reportSafeError } from '../utils/security';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  correlationId: string;
}

/**
 * Module 9.3 — Fail-Secure Global Error Boundary.
 * Catches unexpected render failures, hides raw stack traces / internal paths,
 * and shows an opaque recovery screen with a unique correlation ID.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    correlationId: '',
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      correlationId: generateCorrelationId(),
    };
  }

  componentDidCatch(error: Error): void {
    reportSafeError({
      where: 'AppErrorBoundary',
      error,
      severity: 'FATAL',
      correlationId: this.state.correlationId || undefined,
    });
  }

  private handleResetToHome = (): void => {
    this.setState({ hasError: false, correlationId: '' }, () => {
      try {
        router.replace('/');
      } catch {
        // Router may already be at root
      }
    });
  };

  private handleRetry = (): void => {
    this.setState({ hasError: false, correlationId: '' });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>RECUPERACIÓN SEGURA</Text>
          </View>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>
            Ocurrió un error inesperado en esta pantalla. Tus datos locales están
            a salvo y puedes continuar de forma segura.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Código de referencia</Text>
            <Text style={styles.codeValue}>{this.state.correlationId}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={this.handleResetToHome}
          >
            <Text style={styles.primaryButtonText}>Volver al inicio</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={this.handleRetry}
          >
            <Text style={styles.secondaryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: COLORS.stopRedSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
    marginBottom: SPACING.md,
  },
  badgeText: {
    color: COLORS.stopRedDark,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.base,
    color: COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  codeBox: {
    width: '100%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADII.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  codeLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
    marginBottom: 2,
  },
  codeValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 1.2,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.navy,
    paddingVertical: SPACING.md,
    borderRadius: RADII.lg,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: SPACING.sm,
    borderRadius: RADII.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.inkMuted,
    fontSize: FONT_SIZES.base,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
