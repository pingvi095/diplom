import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { formatIsoDateForDisplay } from "../../lib/validation";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80";

type CurrentLocation = {
  latitude: number;
  longitude: number;
} | null;

type AgeFilter = "all" | "none" | "12" | "16" | "18" | "21";
type DistanceFilter = "default" | "near" | "far";
type AlphaFilter = "default" | "az" | "za";
type DateFilter = "default" | "new" | "old";

type ParticipantRow = {
  event_id: string;
};

const isEventFinished = (endDate: string | null | undefined) => {
  if (!endDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventEndDate = new Date(`${endDate}T00:00:00`);
  eventEndDate.setHours(0, 0, 0, 0);

  return today > eventEndDate;
};

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [role, setRole] = useState("participant");
  const [search, setSearch] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(null);
  const [loading, setLoading] = useState(true);

  const [age, setAge] = useState<AgeFilter>("all");
  const [distanceSort, setDistanceSort] =
    useState<DistanceFilter>("default");
  const [alpha, setAlpha] = useState<AlphaFilter>("default");
  const [dateSort, setDateSort] = useState<DateFilter>("default");

  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadAll();
      requestLocation();
    }, [])
  );

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setCurrentLocation(null);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});

      setCurrentLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      setCurrentLocation(null);
    }
  };

  const loadAll = async () => {
    setLoading(true);

    await Promise.all([
      loadEvents(),
      loadFavorites(),
      loadRole(),
      loadParticipants(),
    ]);

    setLoading(false);
  };

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Ошибка", error.message);
      return;
    }

    setEvents(data || []);
  };

  const loadParticipants = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("event_id")
      .eq("status", "approved");

    if (error) {
      Alert.alert("Ошибка", error.message);
      return;
    }

    setParticipants((data || []) as ParticipantRow[]);
  };

  const loadFavorites = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFavorites([]);
      return;
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("event_id")
      .eq("user_id", user.id);

    if (error) {
      Alert.alert("Ошибка", error.message);
      return;
    }

    setFavorites((data || []).map((item) => String(item.event_id)));
  };

  const loadRole = async () => {
    setRole("participant");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data?.role) {
      setRole(data.role);
    }
  };

  const toggleFavorite = async (eventId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Ошибка", "Нужно войти в аккаунт");
      return;
    }

    if (favorites.includes(String(eventId))) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) {
        Alert.alert("Ошибка", error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert([{ event_id: eventId, user_id: user.id }]);

      if (error) {
        Alert.alert("Ошибка", error.message);
        return;
      }
    }

    loadFavorites();
  };

  const toRad = (value: number) => (value * Math.PI) / 180;

  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const radius = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getEventTime = (date: string | null | undefined) => {
    if (!date) return 0;

    const time = new Date(date).getTime();

    return Number.isNaN(time) ? 0 : time;
  };

  const eventsWithDistance = useMemo(() => {
    return events.map((event) => {
      if (
        currentLocation &&
        event.latitude != null &&
        event.longitude != null
      ) {
        return {
          ...event,
          distance: getDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            Number(event.latitude),
            Number(event.longitude)
          ),
        };
      }

      return {
        ...event,
        distance: null,
      };
    });
  }, [events, currentLocation]);

  const filtered = useMemo(() => {
    let list = [...eventsWithDistance];

    // На главной странице не показываются завершённые мероприятия
    list = list.filter((event) => !isEventFinished(event.end_date));

    const participantsCountByEventId = participants.reduce<
      Record<string, number>
    >((acc, participant) => {
      const eventId = String(participant.event_id);

      acc[eventId] = (acc[eventId] || 0) + 1;

      return acc;
    }, {});

    // Участники не видят мероприятия, где уже нет свободных мест.
    // Организатор и администратор видят все мероприятия.
    if (role !== "organizer" && role !== "admin") {
      list = list.filter((event) => {
        const maxParticipants = Number(event.max_participants);

        if (
          event.max_participants === null ||
          event.max_participants === undefined ||
          Number.isNaN(maxParticipants) ||
          maxParticipants <= 0
        ) {
          return true;
        }

        const currentCount =
          participantsCountByEventId[String(event.id)] || 0;

        return currentCount < maxParticipants;
      });
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      list = list.filter(
        (event) =>
          String(event.title || "")
            .toLowerCase()
            .includes(query) ||
          String(event.description || "")
            .toLowerCase()
            .includes(query) ||
          String(event.location || "")
            .toLowerCase()
            .includes(query)
      );
    }

    if (age !== "all") {
      if (age === "none") {
        list = list.filter((event) => !event.age_limit);
      } else {
        list = list.filter(
          (event) => Number(event.age_limit) === Number(age)
        );
      }
    }

    if (distanceSort === "near") {
      list.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
    }

    if (distanceSort === "far") {
      list.sort((a, b) => (b.distance ?? -1) - (a.distance ?? -1));
    }

    if (alpha === "az") {
      list.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "ru")
      );
    }

    if (alpha === "za") {
      list.sort((a, b) =>
        String(b.title || "").localeCompare(String(a.title || ""), "ru")
      );
    }

    if (dateSort === "new") {
      list.sort((a, b) => getEventTime(b.date) - getEventTime(a.date));
    }

    if (dateSort === "old") {
      list.sort((a, b) => getEventTime(a.date) - getEventTime(b.date));
    }

    return list;
  }, [
    eventsWithDistance,
    participants,
    role,
    search,
    age,
    distanceSort,
    alpha,
    dateSort,
  ]);

  const resetFilters = () => {
    setAge("all");
    setDistanceSort("default");
    setAlpha("default");
    setDateSort("default");
  };

  const FilterChip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.filterChip, active && styles.filterChipActive]}
      >
        <Text
          style={[
            styles.filterChipText,
            active && styles.filterChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: any) => {
    const isFav = favorites.includes(String(item.id));

    const currentCount =
      participants.filter(
        (participant) => String(participant.event_id) === String(item.id)
      ).length || 0;

    const maxParticipants = Number(item.max_participants);

    const isFilled =
      item.max_participants != null &&
      !Number.isNaN(maxParticipants) &&
      maxParticipants > 0 &&
      currentCount >= maxParticipants;

    return (
      <TouchableOpacity
        style={[styles.card, isFilled && styles.cardFilled]}
        activeOpacity={0.9}
        onPress={() =>
          router.push({
            pathname: "/event-details",
            params: { id: item.id },
          })
        }
      >
        <Image
          source={{ uri: item.image_url || DEFAULT_IMAGE }}
          style={styles.image}
        />

        <View style={styles.cardContent}>
          <View style={styles.rowTop}>
            <Text style={styles.eventTitle}>
              {item.title || "Без названия"}
            </Text>

            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                toggleFavorite(item.id);
              }}
            >
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={24}
                color={isFav ? "#ef4444" : "#fff"}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.desc} numberOfLines={2}>
            {item.description || "Описание не указано"}
          </Text>

          <Text style={styles.info}>
            📅 {formatIsoDateForDisplay(item.date)}
          </Text>

          <Text style={styles.info}>
            📍 {item.location || "Место не указано"}
          </Text>

          {!!item.age_limit && (
            <Text style={styles.info}>🔞 {item.age_limit}+</Text>
          )}

          {item.distance != null && (
            <Text style={styles.info}>
              📏 {item.distance.toFixed(1)} км от вас
            </Text>
          )}

          {item.max_participants != null &&
            Number(item.max_participants) > 0 && (
              <Text style={styles.info}>
                👥 {currentCount}/{item.max_participants}
              </Text>
            )}

          {isFilled && (
            <Text style={styles.filledText}>Набор завершён</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Мероприятия</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#9ca3af" />

        <TextInput
          style={styles.input}
          placeholder="Поиск по названию, описанию или месту"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          maxLength={100}
        />

        <TouchableOpacity onPress={() => setFiltersVisible(true)}>
          <Ionicons name="options-outline" size={22} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.centerText}>Загружаем мероприятия...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Мероприятий пока нет</Text>

              <Text style={styles.emptyText}>
                Попробуйте изменить фильтры или создать первое мероприятие.
              </Text>
            </View>
          }
        />
      )}

      {(role === "organizer" || role === "admin") && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/create-event")}
        >
          <Ionicons name="add" size={28} color="#000" />
        </TouchableOpacity>
      )}

      <Modal visible={filtersVisible} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Фильтры</Text>

            <TouchableOpacity onPress={() => setFiltersVisible(false)}>
              <Ionicons name="close" size={28} color="#22c55e" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Возраст</Text>

            <View style={styles.grid}>
              <FilterChip
                label="Все"
                active={age === "all"}
                onPress={() => setAge("all")}
              />

              <FilterChip
                label="Без ограничения"
                active={age === "none"}
                onPress={() => setAge("none")}
              />

              <FilterChip
                label="12+"
                active={age === "12"}
                onPress={() => setAge("12")}
              />

              <FilterChip
                label="16+"
                active={age === "16"}
                onPress={() => setAge("16")}
              />

              <FilterChip
                label="18+"
                active={age === "18"}
                onPress={() => setAge("18")}
              />

              <FilterChip
                label="21+"
                active={age === "21"}
                onPress={() => setAge("21")}
              />
            </View>

            <Text style={styles.sectionTitle}>Расстояние</Text>

            <View style={styles.grid}>
              <FilterChip
                label="Ближе"
                active={distanceSort === "near"}
                onPress={() => setDistanceSort("near")}
              />

              <FilterChip
                label="Дальше"
                active={distanceSort === "far"}
                onPress={() => setDistanceSort("far")}
              />

              <FilterChip
                label="Без сортировки"
                active={distanceSort === "default"}
                onPress={() => setDistanceSort("default")}
              />
            </View>

            <Text style={styles.sectionTitle}>Алфавит</Text>

            <View style={styles.grid}>
              <FilterChip
                label="По умолчанию"
                active={alpha === "default"}
                onPress={() => setAlpha("default")}
              />

              <FilterChip
                label="А → Я"
                active={alpha === "az"}
                onPress={() => setAlpha("az")}
              />

              <FilterChip
                label="Я → А"
                active={alpha === "za"}
                onPress={() => setAlpha("za")}
              />
            </View>

            <Text style={styles.sectionTitle}>Дата мероприятия</Text>

            <View style={styles.grid}>
              <FilterChip
                label="По умолчанию"
                active={dateSort === "default"}
                onPress={() => setDateSort("default")}
              />

              <FilterChip
                label="Сначала новые"
                active={dateSort === "new"}
                onPress={() => setDateSort("new")}
              />

              <FilterChip
                label="Сначала старые"
                active={dateSort === "old"}
                onPress={() => setDateSort("old")}
              />
            </View>

            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetText}>Сбросить фильтры</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },

  header: {
    color: "#fff",
    fontSize: 28,
    marginBottom: 10,
    fontWeight: "700",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
    gap: 10,
  },

  input: {
    color: "#fff",
    flex: 1,
    fontSize: 14,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },

  cardFilled: {
    opacity: 0.85,
  },

  image: {
    width: "100%",
    height: 160,
  },

  cardContent: {
    padding: 12,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  eventTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    paddingRight: 10,
  },

  desc: {
    color: "#9ca3af",
    marginTop: 8,
  },

  info: {
    color: "#fff",
    marginTop: 6,
  },

  filledText: {
    color: "#f59e0b",
    marginTop: 8,
    fontWeight: "700",
  },

  centerBox: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginTop: 16,
  },

  centerText: {
    color: "#9ca3af",
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyText: {
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },

  addButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#22c55e",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "500",
  },

  sectionTitle: {
    color: "#22c55e",
    fontSize: 18,
    marginTop: 14,
    marginBottom: 10,
    fontWeight: "600",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  filterChip: {
    backgroundColor: "#111827",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 46,
    justifyContent: "center",
  },

  filterChipActive: {
    backgroundColor: "#22c55e",
  },

  filterChipText: {
    color: "#cbd5e1",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },

  filterChipTextActive: {
    color: "#000",
    fontWeight: "700",
  },

  resetButton: {
    backgroundColor: "#334155",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 30,
  },

  resetText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});