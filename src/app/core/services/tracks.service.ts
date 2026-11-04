import { Injectable } from '@angular/core';
import { Track } from '../models/domain.models';
import { mapTrack } from './mappers';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class TracksService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<Track[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tracks')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapTrack(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<Track | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tracks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapTrack(data as Record<string, unknown>) : null;
  }

  async create(input: Omit<Track, 'id'>): Promise<Track> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tracks')
      .insert({ name: input.name, country: input.country })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapTrack(data as Record<string, unknown>);
  }

  async update(id: string, input: Omit<Track, 'id'>): Promise<Track> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tracks')
      .update({ name: input.name, country: input.country })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapTrack(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('tracks')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
