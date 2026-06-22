import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SelectedEventImage, uploadEventImage } from "../lib/eventImages";
import { supabase } from "../lib/supabase";
import {
  displayDateToIsoDate,
  isValidDisplayDate,
  sanitizeDigits,
  sanitizeDisplayDateInput,
} from "../lib/validation";

type AddressSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

export default function CreateEvent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationText, setLocationText] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(null);
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(
    null,
  );
  const [maxParticipants, setMaxParticipants] = useState("");
  const [ageLimit, setAgeLimit] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedEventImage | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSearchedRef = useRef("");
  const selectedAddressRef = useRef("");

  const normalizeAddressText = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/g, "")
      .trim();

  const buildNominatimUrl = (query: string, limit: number) => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("accept-language", "ru");
    url.searchParams.set("q", query);
    return url.toString();
  };

  const formatAddressFromSuggestion = (item: AddressSuggestion) => {
    const address = item.address;

    if (!address) {
      return item.display_name;
    }

    const parts: string[] = [];

    if (address.state) {
      parts.push(address.state);
    }

    if (address.county) {
      parts.push(address.county);
    }

    if (address.city && address.city !== address.state) {
      parts.push(address.city);
    }

    if (address.town) {
      parts.push(address.town);
    }

    if (address.village) {
      const name = address.village;
      parts.push(
        name.toLowerCase().includes("деревня") ? name : `деревня ${name}`,
      );
    }

    if (address.hamlet) {
      const name = address.hamlet;
      parts.push(
        name.toLowerCase().includes("д.") ||
          name.toLowerCase().includes("деревня")
          ? name
          : `д. ${name}`,
      );
    }

    if (address.suburb) {
      parts.push(address.suburb);
    }

    if (address.road) {
      if (address.house_number) {
        parts.push(`${address.road}, д. ${address.house_number}`);
      } else {
        parts.push(address.road);
      }
    }

    return parts.length > 0 ? parts.join(", ") : item.display_name;
  };

  const fetchSuggestions = async (query: string, limit: number) => {
    const controller = new AbortController();

    abortRef.current?.abort();
    abortRef.current = controller;

    const response = await fetch(buildNominatimUrl(query, limit), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
        "User-Agent": "CreateEventApp/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as AddressSuggestion[];
  };

  const searchAddress = async (text: string) => {
    const normalized = normalizeAddressText(text);

    selectedAddressRef.current = "";
    setSelectedLatitude(null);
    setSelectedLongitude(null);
    setLocationText(text);
    setAddressError("");

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (normalized.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      lastSearchedRef.current = "";
      return;
    }

    const queryKey = normalized.toLowerCase();

    debounceRef.current = setTimeout(async () => {
      setAddressLoading(true);

      try {
        const results = await fetchSuggestions(normalized, 7);

        lastSearchedRef.current = queryKey;

        const mapped = (Array.isArray(results) ? results : []).map((item) => ({
          ...item,
          display_name: formatAddressFromSuggestion(item),
        }));

        setAddressSuggestions(mapped);

        if (mapped.length === 0) {
          setAddressError("Адрес не найден");
        } else {
          setAddressError("");
        }
      } catch (error) {
        console.log("Address search error:", error);
        setAddressError("Не удалось загрузить подсказки");
      } finally {
        setAddressLoading(false);
      }
    }, 350);
  };

  const selectAddress = (item: AddressSuggestion) => {
    const finalAddress = normalizeAddressText(item.display_name);

    selectedAddressRef.current = finalAddress;
    lastSearchedRef.current = finalAddress.toLowerCase();

    setLocationText(finalAddress);
    setSelectedLatitude(Number(item.lat));
    setSelectedLongitude(Number(item.lon));
    setAddressSuggestions([]);
    setAddressError("");
  };

  const geocodeAddress = async (address: string) => {
    const normalized = normalizeAddressText(address);

    const response = await fetch(buildNominatimUrl(normalized, 1), {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ru",
        "User-Agent": "CreateEventApp/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as AddressSuggestion[];

    if (!data || data.length === 0) {
      throw new Error("Адрес не найден");
    }

    return {
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon),
      displayName: formatAddressFromSuggestion(data[0]),
    };
  };

  const pickImageFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert("Ошибка", "Нужен доступ к галерее");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const image = result.assets[0];

    setSelectedImage({
      uri: image.uri,
      base64: image.base64,
      fileName: image.fileName,
      mimeType: image.mimeType,
    });
  };

  const pickImageFromFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    const image = result.assets[0];

    setSelectedImage({
      uri: image.uri,
      fileName: image.name,
      mimeType: image.mimeType,
    });
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      Alert.alert("Ошибка", "Введите название мероприятия");
      return;
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      Alert.alert(
        "Ошибка",
        `Название мероприятия не должно быть длиннее ${MAX_TITLE_LENGTH} символов`,
      );
      return;
    }

    if (!trimmedDescription) {
      Alert.alert("Ошибка", "Введите описание мероприятия");
      return;
    }

    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      Alert.alert(
        "Ошибка",
        `Описание мероприятия не должно быть длиннее ${MAX_DESCRIPTION_LENGTH} символов`,
      );
      return;
    }

    if (!date.trim() || !isValidDisplayDate(date)) {
      Alert.alert("Ошибка", "Введите дату начала в формате ДД.ММ.ГГГГ");
      return;
    }

    if (!endDate.trim() || !isValidDisplayDate(endDate)) {
      Alert.alert("Ошибка", "Введите дату окончания в формате ДД.ММ.ГГГГ");
      return;
    }

    const startDateIso = displayDateToIsoDate(date);
    const endDateIso = displayDateToIsoDate(endDate);

    if (new Date(endDateIso) < new Date(startDateIso)) {
      Alert.alert(
        "Ошибка",
        "Дата окончания мероприятия не может быть раньше даты начала",
      );
      return;
    }

    if (!locationText.trim()) {
      Alert.alert("Ошибка", "Введите адрес или место проведения");
      return;
    }
if (
  maxParticipants &&
  (Number(maxParticipants) < 1 || Number(maxParticipants) > 100000)
) {
  Alert.alert(
    "Ошибка",
    "Количество участников должно быть от 1 до 100000"
  );
  return;
}
    if (ageLimit && Number(ageLimit) > 100) {
      Alert.alert("Ошибка", "Возрастное ограничение не может быть больше 100");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Ошибка", "Нужно войти в аккаунт");
        return;
      }

      let latitude = selectedLatitude;
      let longitude = selectedLongitude;
      let finalLocationText = normalizeAddressText(locationText);

      if (latitude === null || longitude === null) {
        const geocoded = await geocodeAddress(finalLocationText);

        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        finalLocationText = normalizeAddressText(geocoded.displayName);

        selectedAddressRef.current = finalLocationText;
        setLocationText(finalLocationText);
      }

      let imageUrl = null;

      if (selectedImage) {
        try {
          imageUrl = await uploadEventImage(selectedImage, user.id);
        } catch (error: any) {
          Alert.alert(
            "Ошибка фото",
            error.message || "Не удалось загрузить фото мероприятия",
          );
          return;
        }
      }

      const { error } = await supabase.from("events").insert([
        {
          title: trimmedTitle,
          description: trimmedDescription,
          date: startDateIso,
          end_date: endDateIso,
          location: finalLocationText,
          max_participants: maxParticipants ? Number(maxParticipants) : null,
          age_limit: ageLimit ? Number(ageLimit) : null,
          image_url: imageUrl,
          latitude,
          longitude,
          user_id: user.id,
        },
      ]);

      if (error) {
        Alert.alert("Ошибка", error.message);
        return;
      }

      Alert.alert("Успех", "Мероприятие создано");
      router.back();
    } catch (error: any) {
      Alert.alert("Ошибка", error.message || "Не удалось создать мероприятие");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      abortRef.current?.abort();
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Создать мероприятие</Text>

      <TextInput
        placeholder="Название"
        placeholderTextColor="#888"
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE_LENGTH}
      />

      <Text style={styles.counter}>
        {title.length}/{MAX_TITLE_LENGTH}
      </Text>

      <TextInput
        placeholder="Описание"
        placeholderTextColor="#888"
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={MAX_DESCRIPTION_LENGTH}
      />

      <Text style={styles.counter}>
        {description.length}/{MAX_DESCRIPTION_LENGTH}
      </Text>

      <TextInput
        placeholder="Дата начала (например 20.05.2026)"
        placeholderTextColor="#888"
        style={styles.input}
        value={date}
        onChangeText={(text) => setDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
        maxLength={10}
      />

      <TextInput
        placeholder="Дата окончания (например 21.05.2026)"
        placeholderTextColor="#888"
        style={styles.input}
        value={endDate}
        onChangeText={(text) => setEndDate(sanitizeDisplayDateInput(text))}
        keyboardType="numeric"
        maxLength={10}
      />

      <View style={styles.addressBlock}>
        <TextInput
          placeholder="Адрес / место"
          placeholderTextColor="#888"
          style={styles.input}
          value={locationText}
          onChangeText={searchAddress}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          maxLength={250}
        />

        {addressLoading ? (
          <Text style={styles.addressStatus}>Поиск адресов...</Text>
        ) : null}

        {!addressLoading && addressError ? (
          <Text style={styles.addressError}>{addressError}</Text>
        ) : null}

        {!addressLoading && addressSuggestions.length > 0 ? (
          <View style={styles.suggestionsList}>
            {addressSuggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item.display_name}-${index}`}
                style={[
                  styles.suggestionItem,
                  index === addressSuggestions.length - 1 &&
                    styles.suggestionItemLast,
                ]}
                onPress={() => selectAddress(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.suggestionText}>{item.display_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      <TextInput
        placeholder="Максимальное количество участников"
        placeholderTextColor="#888"
        style={styles.input}
        value={maxParticipants}
        onChangeText={(text) => setMaxParticipants(sanitizeDigits(text))}
        keyboardType="numeric"
        maxLength={5}
      />

      <TextInput
        placeholder="Возрастное ограничение (например 18)"
        placeholderTextColor="#888"
        style={styles.input}
        value={ageLimit}
        onChangeText={(text) => setAgeLimit(sanitizeDigits(text))}
        keyboardType="numeric"
        maxLength={3}
      />

      <View style={styles.imageBox}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage.uri }} style={styles.preview} />

            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>Удалить выбранное фото</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.imageHint}>Фото мероприятия не выбрано</Text>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImageFromGallery}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Выбрать из галереи</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={pickImageFromFile}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Выбрать из файлов</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Создать</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#111827",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },

  counter: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "right",
    marginTop: -6,
    marginBottom: 10,
  },

  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  addressBlock: {
    marginBottom: 10,
    position: "relative",
    zIndex: 9999,
  },

  addressStatus: {
    color: "#9ca3af",
    marginBottom: 6,
    fontSize: 12,
    paddingHorizontal: 2,
  },

  addressError: {
    color: "#fca5a5",
    marginBottom: 6,
    fontSize: 12,
    paddingHorizontal: 2,
  },

  suggestionsList: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
    marginBottom: 10,
    zIndex: 9999,
    elevation: 10,
  },

  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },

  suggestionItemLast: {
    borderBottomWidth: 0,
  },

  suggestionText: {
    color: "#fff",
    fontSize: 14,
  },

  imageBox: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },

  preview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },

  imageHint: {
    color: "#9ca3af",
    marginBottom: 10,
    textAlign: "center",
  },

  secondaryButton: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },

  secondaryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },

  removeImageButton: {
    backgroundColor: "#7f1d1d",
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },

  removeImageText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#22c55e",
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center",
  },

  buttonText: {
    textAlign: "center",
    fontWeight: "700",
    color: "#000",
  },
});
