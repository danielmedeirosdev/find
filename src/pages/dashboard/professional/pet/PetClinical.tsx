import { useCallback, useEffect, useState } from 'react'
import { FieldLabel } from '../../../../components/FormHints'
import { Toast } from '../../../../components/MediaUI'
import { formatDate } from '../../../../lib/format'
import { supabase } from '../../../../lib/supabase'
import type { Barber, Pet, PetConsultation, PetVaccination } from '../../../../lib/types'

interface Props { shopId: string }

function localDateTimeInput() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function PetClinical({ shopId }: Props) {
  const [pets, setPets] = useState<Pick<Pet, 'id' | 'name'>[]>([])
  const [team, setTeam] = useState<Pick<Barber, 'id' | 'name'>[]>([])
  const [consultations, setConsultations] = useState<PetConsultation[]>([])
  const [vaccinations, setVaccinations] = useState<PetVaccination[]>([])
  const [petId, setPetId] = useState('')
  const [veterinarianId, setVeterinarianId] = useState('')
  const [consultationDate, setConsultationDate] = useState(localDateTimeInput)
  const [weightKg, setWeightKg] = useState('')
  const [notes, setNotes] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [vaccinePetId, setVaccinePetId] = useState('')
  const [vaccineName, setVaccineName] = useState('')
  const [administeredOn, setAdministeredOn] = useState('')
  const [nextDueDate, setNextDueDate] = useState('')
  const [veterinarianName, setVeterinarianName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [petsResult, teamResult, consultationsResult, vaccinationsResult] = await Promise.all([
      supabase.from('pets').select('id, name').eq('shop_id', shopId).order('name'),
      supabase.from('barbers').select('id, name').eq('shop_id', shopId).order('name'),
      supabase.from('pet_consultations').select('*, pets(id, name), barbers(id, name)').eq('shop_id', shopId).order('consultation_date', { ascending: false }).limit(50),
      supabase.from('pet_vaccinations').select('*, pets(id, name)').eq('shop_id', shopId).order('next_due_date').limit(50),
    ])
    setPets((petsResult.data as Pick<Pet, 'id' | 'name'>[]) || [])
    setTeam((teamResult.data as Pick<Barber, 'id' | 'name'>[]) || [])
    setConsultations((consultationsResult.data as PetConsultation[]) || [])
    setVaccinations((vaccinationsResult.data as PetVaccination[]) || [])
  }, [shopId])

  useEffect(() => { load() }, [load])

  const saveConsultation = async () => {
    if (!petId || !notes.trim() || !consultationDate) {
      setToast('Selecione o pet e registre as observações da consulta.')
      return
    }
    const parsedConsultationDate = new Date(consultationDate)
    if (Number.isNaN(parsedConsultationDate.getTime())) {
      setToast('Informe uma data válida para a consulta.')
      return
    }
    const weight = weightKg ? Number(weightKg.replace(',', '.')) : null
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      setToast('Informe um peso válido.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('pet_consultations').insert({
      shop_id: shopId,
      pet_id: petId,
      veterinarian_id: veterinarianId || null,
      consultation_date: parsedConsultationDate.toISOString(),
      weight_kg: weight,
      notes: notes.trim(),
      return_date: returnDate || null,
    })
    setSaving(false)
    if (error) return setToast(error.message)
    setNotes(''); setWeightKg(''); setReturnDate('')
    setToast('Consulta registrada.')
    load()
  }

  const saveVaccination = async () => {
    if (!vaccinePetId || !vaccineName.trim()) {
      setToast('Selecione o pet e informe a vacina.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('pet_vaccinations').insert({
      shop_id: shopId,
      pet_id: vaccinePetId,
      vaccine_name: vaccineName.trim(),
      administered_on: administeredOn || null,
      next_due_date: nextDueDate || null,
      veterinarian_name: veterinarianName.trim() || null,
    })
    setSaving(false)
    if (error) return setToast(error.message)
    setVaccineName(''); setAdministeredOn(''); setNextDueDate(''); setVeterinarianName('')
    setToast('Vacina registrada.')
    load()
  }

  return <div className="space-y-9">
    <Toast message={toast} onClose={() => setToast(null)} />
    <div><h2 className="font-display text-2xl text-white">Clínica básica</h2><p className="mt-1 text-sm text-charcoal-muted">Consultas, peso, observações, retornos e vacinas. Este módulo não emite prescrições.</p></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-charcoal-light p-5">
        <h3 className="font-medium text-white">Registrar consulta</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Select label="Pet" value={petId} onChange={setPetId} options={pets} />
          <Select label="Veterinário responsável" value={veterinarianId} onChange={setVeterinarianId} options={team} optional />
          <Input label="Data e hora" type="datetime-local" value={consultationDate} onChange={setConsultationDate} />
          <Input label="Peso (kg)" type="number" value={weightKg} onChange={setWeightKg} />
          <Input label="Retorno recomendado" type="date" value={returnDate} onChange={setReturnDate} />
        </div>
        <label className="mt-3 block"><FieldLabel>Observações clínicas</FieldLabel><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white focus:border-brass focus:outline-none" /></label>
        <SaveButton onClick={saveConsultation} saving={saving}>Salvar consulta</SaveButton>
      </section>
      <section className="rounded-xl border border-charcoal-light p-5">
        <h3 className="font-medium text-white">Registrar vacina</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Select label="Pet" value={vaccinePetId} onChange={setVaccinePetId} options={pets} />
          <Input label="Vacina" value={vaccineName} onChange={setVaccineName} />
          <Input label="Aplicada em" type="date" value={administeredOn} onChange={setAdministeredOn} />
          <Input label="Próxima dose" type="date" value={nextDueDate} onChange={setNextDueDate} />
          <Input label="Veterinário" value={veterinarianName} onChange={setVeterinarianName} />
        </div>
        <SaveButton onClick={saveVaccination} saving={saving}>Salvar vacina</SaveButton>
      </section>
    </div>
    <div className="grid gap-8 xl:grid-cols-2">
      <History title="Consultas recentes" empty="Nenhuma consulta registrada.">{consultations.map((row) => <HistoryRow key={row.id} title={row.pets?.name || 'Pet'} detail={`${new Date(row.consultation_date).toLocaleString('pt-BR')}${row.barbers?.name ? ` · ${row.barbers.name}` : ''}`} note={row.notes || undefined} />)}</History>
      <History title="Vacinas" empty="Nenhuma vacina registrada.">{vaccinations.map((row) => <HistoryRow key={row.id} title={`${row.pets?.name || 'Pet'} · ${row.vaccine_name}`} detail={row.next_due_date ? `Próxima dose: ${formatDate(row.next_due_date)}` : row.administered_on ? `Aplicada em ${formatDate(row.administered_on)}` : 'Sem data informada'} />)}</History>
    </div>
  </div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><FieldLabel>{label}</FieldLabel><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white focus:border-brass focus:outline-none" /></label>
}
function Select({ label, value, onChange, options, optional = false }: { label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[]; optional?: boolean }) {
  return <label><FieldLabel>{label}</FieldLabel><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-charcoal-light bg-charcoal px-3 py-2 text-white focus:border-brass focus:outline-none"><option value="">{optional ? 'Não informado' : 'Selecione'}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
}
function SaveButton({ onClick, saving, children }: { onClick: () => void; saving: boolean; children: string }) {
  return <button type="button" onClick={onClick} disabled={saving} className="mt-4 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-charcoal disabled:opacity-50">{saving ? 'Salvando...' : children}</button>
}
function History({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const rows = Array.isArray(children) ? children : [children]
  return <section><h3 className="mb-3 font-medium text-white">{title}</h3>{rows.length === 0 ? <p className="text-sm text-charcoal-muted">{empty}</p> : <div className="space-y-2">{children}</div>}</section>
}
function HistoryRow({ title, detail, note }: { title: string; detail: string; note?: string }) {
  return <div className="rounded-xl border border-charcoal-light p-4"><p className="font-medium text-white">{title}</p><p className="mt-1 text-sm text-charcoal-muted">{detail}</p>{note ? <p className="mt-2 text-sm text-white">{note}</p> : null}</div>
}
