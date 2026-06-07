import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../lib/supabase";
import { formatIsoDateForDisplay } from "../lib/validation";

const statusLabels: Record<string, string> = {
  approved: "Активен",
  active: "Активен",
  pending: "Ожидает",
  declined: "Отклонён",
};

export default function TicketDetails() {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const ticketEventId = Array.isArray(eventId) ? eventId[0] : eventId;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ticketEventId) loadTicket();
  }, [ticketEventId]);

  const loadTicket = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setTicket(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("tickets")
      .select(
        `
        id,
        status,
        created_at,
        events (
          id,
          title,
          description,
          date,
          location,
          age_limit,
          distance_km
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("event_id", ticketEventId)
      .maybeSingle();

    setLoading(false);

    if (error) {
      Alert.alert("Ошибка", error.message);
      return;
    }

    setTicket(data || null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.empty}>Загружаем билет...</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Билет</Text>
        <Text style={styles.empty}>Билет не найден</Text>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const event = ticket.events;
  const status = ticket.status || "active";

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Билет</Text>

      <View style={styles.ticketCard}>
        <Text style={styles.badge}>ACTIVE TICKET</Text>
        <Text style={styles.eventTitle}>{event?.title || "Событие"}</Text>
        <Text style={styles.text}>
          {event?.description || "Описание не указано"}
        </Text>

        <View style={styles.infoBlock}>
          <Text style={styles.info}>
            📅 {formatIsoDateForDisplay(event?.date)}
          </Text>
          <Text style={styles.info}>
            📍 {event?.location || "Место не указано"}
          </Text>
          <Text style={styles.info}>
            🔞 {event?.age_limit ? `${event.age_limit}+` : "Без ограничения"}
          </Text>
          {event?.distance_km !== null && event?.distance_km !== undefined && (
            <Text style={styles.info}>📏 {event.distance_km} км</Text>
          )}
        </View>

        <View style={styles.qrBox}>
          <QRCode value={String(ticket.id)} size={160} />
          <Text style={styles.qrLabel}>Код билета</Text>
          <Text style={styles.qrCode}>
            {String(ticket.id).slice(0, 8).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.status}>
          Статус: {statusLabels[status] || status}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },
  backIcon: {
    position: "absolute",
    top: 40,
    left: 16,
    zIndex: 10,
    backgroundColor: "#111827",
    borderRadius: 999,
    padding: 8,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 80,
    marginBottom: 16,
  },
  empty: {
    color: "#9ca3af",
    marginTop: 10,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  ticketCard: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 18,
    marginBottom: 40,
  },
  badge: {
    color: "#22c55e",
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
  eventTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  text: {
    color: "#cbd5e1",
    marginTop: 10,
  },
  infoBlock: {
    marginTop: 14,
  },
  info: {
    color: "#fff",
    marginTop: 6,
  },
  qrBox: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  qrLabel: {
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 6,
  },
  qrCode: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 3,
  },
  status: {
    color: "#22c55e",
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
});
