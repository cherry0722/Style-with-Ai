import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CalendarEvent } from '../types';

interface CalendarState {
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
  getEventsForDateRange: (startDate: string, endDate: string) => CalendarEvent[];
  reset: () => void;
}

export const useCalendar = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],
      
      addEvent: (eventData) => {
        const newEvent: CalendarEvent = {
          ...eventData,
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          events: [...state.events, newEvent].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          ),
        }));
      },
      
      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id ? { ...event, ...updates } : event
          ),
        }));
      },
      
      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((event) => event.id !== id),
        }));
      },
      
      getEventsForDate: (date) => {
        const events = get().events;
        return events.filter((event) => event.date === date);
      },
      
      getEventsForDateRange: (startDate, endDate) => {
        const events = get().events;
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return events.filter((event) => {
          const eventDate = new Date(event.date);
          return eventDate >= start && eventDate <= end;
        });
      },
      
      reset: () => {
        set({ events: [] });
      },
    }),
    {
      name: 'myra-calendar',
      version: 1,
    }
  )
);
