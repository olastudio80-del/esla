import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Gap, Pill } from '@/components/ui/Button';
import { Caption, Card, SectionTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';
import { listCheckins, type Checkin } from '@/db/checkins';
import {
  addCondition,
  addDocument,
  deleteCondition,
  deleteDocument,
  listConditions,
  listDocuments,
} from '@/db/documents';
import type { ConditionKind, ConditionRow, DocKind, DocumentRow } from '@/db/types';
import { symptomById } from '@/data/symptoms';
import { shareMedicalCard } from '@/features/medicalCard';
import { useT } from '@/i18n';
import { dateKey, timeOf } from '@/lib/date';
import { usePrefs } from '@/store/prefs';
import { color, radius, semantic, space } from '@/theme/tokens';

export default function HistoryScreen() {
  const { t, lang } = useT();
  const { prefs } = usePrefs();

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [diagnoses, setDiagnoses] = useState<ConditionRow[]>([]);
  const [allergies, setAllergies] = useState<ConditionRow[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [draft, setDraft] = useState<{ kind: ConditionKind; value: string } | null>(null);
  const [preparing, setPreparing] = useState(false);

  const reload = useCallback(async () => {
    const [docs, diag, allerg, checks] = await Promise.all([
      listDocuments(),
      listConditions('diagnosis'),
      listConditions('allergy'),
      listCheckins(10),
    ]);
    setDocuments(docs);
    setDiagnoses(diag);
    setAllergies(allerg);
    setCheckins(checks);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((error) => console.warn('[esla] не удалось загрузить историю', error));
    }, [reload]),
  );

  const age = prefs.birthYear ? new Date().getFullYear() - prefs.birthYear : null;

  return (
    <Screen>
      <SectionTitle title={t('historyTitle')} />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: color.peach,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="subtitle" weight="display">
              {initials(prefs.patientName)}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyLarge" weight="bold">
              {prefs.patientName || t('notSet')}
            </Txt>
            {age != null ? (
              <Txt variant="caption" color={color.inkSoft}>
                {t('years', { n: age })}
              </Txt>
            ) : null}
          </View>
        </View>
      </Card>

      <ConditionBlock
        title={t('diagnoses')}
        addLabel={t('addDiagnosis')}
        items={diagnoses}
        tint={color.skySoft}
        onAdd={() => setDraft({ kind: 'diagnosis', value: '' })}
        onRemove={(id) => void remove(id)}
        emptyLabel={t('notSet')}
      />

      <ConditionBlock
        title={t('allergies')}
        addLabel={t('addAllergy')}
        items={allergies}
        tint={color.blushSoft}
        onAdd={() => setDraft({ kind: 'allergy', value: '' })}
        onRemove={(id) => void remove(id)}
        emptyLabel={t('noAllergies')}
      />

      {draft ? (
        <Card tint={color.app}>
          <Input
            label={draft.kind === 'allergy' ? t('addAllergy') : t('addDiagnosis')}
            value={draft.value}
            onChangeText={(value) => setDraft({ ...draft, value })}
            autoFocus
          />
          <Gap size={3} />
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Button label={t('cancel')} variant="soft" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            <Button
              label={t('save')}
              onPress={() => void saveCondition()}
              disabled={draft.value.trim().length < 2}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : null}

      {checkins.length > 0 ? (
        <View style={{ gap: space(2) }}>
          <Caption>{t('checkinTitle')}</Caption>
          {checkins.map((checkin) => (
            <Card key={checkin.id} tint={checkin.alarm ? semantic.danger : color.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
                <Txt weight="semibold" color={checkin.alarm ? color.card : color.ink}>
                  {checkin.created_at.slice(0, 10)} · {timeOf(checkin.created_at)}
                </Txt>
                <Txt
                  variant="caption"
                  weight="semibold"
                  color={checkin.alarm ? color.card : color.inkSoft}
                >
                  {checkin.feeling === 'good'
                    ? t('feelingGood')
                    : checkin.feeling === 'ok'
                      ? t('feelingOk')
                      : t('feelingBad')}
                </Txt>
              </View>
              {checkin.symptoms.length > 0 ? (
                <Txt
                  variant="body"
                  color={checkin.alarm ? color.card : color.inkSoft}
                  style={{ marginTop: space(2) }}
                >
                  {checkin.symptoms
                    .map((id) => {
                      const symptom = symptomById(id);
                      return symptom ? (lang === 'ru' ? symptom.ru : symptom.uz) : id;
                    })
                    .join(', ')}
                  {checkin.severity ? ` · ${checkin.severity}/5` : ''}
                </Txt>
              ) : null}
              {checkin.note ? (
                <Txt
                  variant="body"
                  color={checkin.alarm ? color.card : color.ink}
                  style={{ marginTop: space(2) }}
                >
                  {checkin.note}
                </Txt>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space(2) }}>
        <Caption>{t('analysesAndReports')}</Caption>
        {documents.length === 0 ? (
          <Txt variant="body" color={color.inkSoft}>
            {t('noDocuments')}
          </Txt>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} padded={false} style={{ padding: space(4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.sm,
                    backgroundColor: color.skySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={doc.mime?.startsWith('image/') ? 'camera' : 'file'} size={20} color={color.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold" numberOfLines={2}>
                    {doc.title}
                  </Txt>
                  <Txt variant="caption" color={color.inkSoft}>
                    {doc.taken_on ?? doc.created_at.slice(0, 10)}
                  </Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('delete')}
                  hitSlop={12}
                  onPress={() => void removeDocument(doc.id)}
                  style={{ padding: space(2) }}
                >
                  <Icon name="x" size={20} color={color.inkSoft} />
                </Pressable>
              </View>
            </Card>
          ))
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <Pill label={t('docFromCamera')} onPress={() => void pickFromCamera()} tint={color.card} />
          <Pill label={t('docFromGallery')} onPress={() => void pickFromGallery()} tint={color.card} />
          <Pill label={t('docFromFiles')} onPress={() => void pickFromFiles()} tint={color.card} />
        </View>
      </View>

      <Card tint={color.blushSoft}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
          <Icon name="stethoscope" size={26} color={color.rose} />
          <Txt variant="bodyLarge" weight="display" style={{ flex: 1 }}>
            {t('emergencyTitle')}
          </Txt>
        </View>
        <Txt variant="body" color={color.inkSoft} style={{ marginTop: space(2) }}>
          {t('emergencyNote')}
        </Txt>
        <Gap size={4} />
        <Button
          label={t('prepareCard')}
          icon="share"
          onPress={() => void prepareCard()}
          busy={preparing}
          large
        />
      </Card>
    </Screen>
  );

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  async function saveCondition() {
    if (!draft) return;
    await addCondition(draft.kind, draft.value);
    setDraft(null);
    await reload();
  }

  async function remove(id: number) {
    await deleteCondition(id);
    await reload();
  }

  async function removeDocument(id: number) {
    // Файл остаётся на телефоне: удаляем только ссылку из истории.
    await deleteDocument(id);
    await reload();
  }

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    await storeAsset(result, 'analysis');
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    await storeAsset(result, 'report');
  }

  async function storeAsset(result: ImagePicker.ImagePickerResult, kind: DocKind) {
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    await addDocument({
      // Имя по дате: спрашивать название у пожилого человека на этом шаге
      // лишнее, переименовать можно позже.
      title: `${t('analysesAndReports')} ${dateKey()}`,
      kind,
      uri: asset.uri,
      mime: asset.mimeType ?? 'image/jpeg',
    });
    await reload();
  }

  async function pickFromFiles() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    await addDocument({
      title: asset.name,
      kind: 'other',
      uri: asset.uri,
      mime: asset.mimeType ?? null,
    });
    await reload();
  }

  async function prepareCard() {
    setPreparing(true);
    try {
      await shareMedicalCard({
        lang,
        patientName: prefs.patientName,
        birthYear: prefs.birthYear,
      });
    } catch (error) {
      console.warn('[esla] не удалось подготовить медкарту', error);
      Alert.alert(t('retry'));
    } finally {
      setPreparing(false);
    }
  }
}

/** Блок диагнозов или аллергий: чипы со возможностью удалить. */
function ConditionBlock({
  title,
  addLabel,
  items,
  tint,
  emptyLabel,
  onAdd,
  onRemove,
}: {
  title: string;
  addLabel: string;
  items: ConditionRow[];
  tint: string;
  emptyLabel: string;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <View style={{ gap: space(2) }}>
      <Caption>{title}</Caption>
      {items.length === 0 ? (
        <Txt variant="body" color={color.inkSoft}>
          {emptyLabel}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onLongPress={() => onRemove(item.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(2),
              paddingHorizontal: space(4),
              minHeight: 48,
              borderRadius: radius.pill,
              backgroundColor: tint,
            }}
          >
            <Txt weight="semibold">{item.label}</Txt>
          </Pressable>
        ))}
        <Pill label={`+ ${addLabel}`} onPress={onAdd} tint={color.card} />
      </View>
    </View>
  );
}
