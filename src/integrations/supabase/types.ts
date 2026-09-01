export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      commercial_document_history: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          document_id: string
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          document_id: string
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          document_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_document_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          discount_value: number
          document_id: string
          extra_notes: string | null
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description: string
          discount_value?: number
          document_id: string
          extra_notes?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          discount_value?: number
          document_id?: string
          extra_notes?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_document_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_document_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_documents: {
        Row: {
          client_city: string | null
          client_company: string
          client_contact: string | null
          client_email: string | null
          client_neighborhood: string | null
          client_number: string | null
          client_phone: string | null
          client_postal_code: string | null
          client_segment: string | null
          client_state: string | null
          client_street: string | null
          converted_from_id: string | null
          created_at: string
          created_by: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          discount_type: string
          discount_value: number
          doc_number: number
          doc_type: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year: number
          id: string
          issue_date: string
          issued_at: string | null
          lead_id: string
          notes: string | null
          number_label: string
          owner_id: string
          payment_deadline: string | null
          payment_method_id: string | null
          payment_notes: string | null
          payment_terms: string | null
          status: string
          total_discount: number
          total_general: number
          total_parts: number
          total_services: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          client_city?: string | null
          client_company?: string
          client_contact?: string | null
          client_email?: string | null
          client_neighborhood?: string | null
          client_number?: string | null
          client_phone?: string | null
          client_postal_code?: string | null
          client_segment?: string | null
          client_state?: string | null
          client_street?: string | null
          converted_from_id?: string | null
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_type?: string
          discount_value?: number
          doc_number: number
          doc_type: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year?: number
          id?: string
          issue_date?: string
          issued_at?: string | null
          lead_id: string
          notes?: string | null
          number_label: string
          owner_id?: string
          payment_deadline?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_terms?: string | null
          status?: string
          total_discount?: number
          total_general?: number
          total_parts?: number
          total_services?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          client_city?: string | null
          client_company?: string
          client_contact?: string | null
          client_email?: string | null
          client_neighborhood?: string | null
          client_number?: string | null
          client_phone?: string | null
          client_postal_code?: string | null
          client_segment?: string | null
          client_state?: string | null
          client_street?: string | null
          converted_from_id?: string | null
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          discount_type?: string
          discount_value?: number
          doc_number?: number
          doc_type?: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year?: number
          id?: string
          issue_date?: string
          issued_at?: string | null
          lead_id?: string
          notes?: string | null
          number_label?: string
          owner_id?: string
          payment_deadline?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_terms?: string | null
          status?: string
          total_discount?: number
          total_general?: number
          total_parts?: number
          total_services?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_documents_converted_from_id_fkey"
            columns: ["converted_from_id"]
            isOneToOne: false
            referencedRelation: "commercial_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          default_payment_terms: string | null
          default_validity_days: number
          email: string | null
          footer_note: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          whatsapp_template: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          default_payment_terms?: string | null
          default_validity_days?: number
          email?: string | null
          footer_note?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          whatsapp_template?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          default_payment_terms?: string | null
          default_validity_days?: number
          email?: string | null
          footer_note?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          whatsapp_template?: string
        }
        Relationships: []
      }
      contact_types: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          doc_type: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year: number
          last_number: number
        }
        Insert: {
          doc_type: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year: number
          last_number?: number
        }
        Update: {
          doc_type?: Database["public"]["Enums"]["commercial_doc_type"]
          doc_year?: number
          last_number?: number
        }
        Relationships: []
      }
      item_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      job_roles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_appointments: {
        Row: {
          contact_type_id: string | null
          created_at: string
          created_by: string
          id: string
          lead_id: string
          notes: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          contact_type_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id: string
          notes?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          contact_type_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_appointments_contact_type_id_fkey"
            columns: ["contact_type_id"]
            isOneToOne: false
            referencedRelation: "contact_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_values: {
        Row: {
          field_id: string
          id: string
          lead_id: string
          value: Json | null
        }
        Insert: {
          field_id: string
          id?: string
          lead_id: string
          value?: Json | null
        }
        Update: {
          field_id?: string
          id?: string
          lead_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "segment_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_products: {
        Row: {
          lead_id: string
          product_id: string
        }
        Insert: {
          lead_id: string
          product_id: string
        }
        Update: {
          lead_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          new_status: Database["public"]["Enums"]["lead_status"]
          old_status: Database["public"]["Enums"]["lead_status"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          new_status: Database["public"]["Enums"]["lead_status"]
          old_status?: Database["public"]["Enums"]["lead_status"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          new_status?: Database["public"]["Enums"]["lead_status"]
          old_status?: Database["public"]["Enums"]["lead_status"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_visits: {
        Row: {
          arrived_at: string | null
          contact_person: string | null
          created_at: string
          distance_km: number | null
          duration_minutes: number | null
          finished_at: string | null
          id: string
          lead_id: string
          next_contact_date: string | null
          notes: string | null
          result: Database["public"]["Enums"]["visit_result"]
          route_id: string | null
          started_at: string | null
          stop_id: string | null
          travel_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          contact_person?: string | null
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          lead_id: string
          next_contact_date?: string | null
          notes?: string | null
          result?: Database["public"]["Enums"]["visit_result"]
          route_id?: string | null
          started_at?: string | null
          stop_id?: string | null
          travel_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          arrived_at?: string | null
          contact_person?: string | null
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          lead_id?: string
          next_contact_date?: string | null
          notes?: string | null
          result?: Database["public"]["Enums"]["visit_result"]
          route_id?: string | null
          started_at?: string | null
          stop_id?: string | null
          travel_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_visits_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "visit_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_visits_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "visit_route_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          facebook: string | null
          id: string
          instagram: string | null
          latitude: number | null
          longitude: number | null
          neighborhood_id: string | null
          neighborhood_name: string | null
          next_contact_date: string | null
          notes: string | null
          number: string | null
          phone: string | null
          postal_code: string | null
          segment_id: string | null
          source: string
          source_external_id: string | null
          source_provider: string | null
          source_region: string | null
          source_searched_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          street_id: string | null
          street_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name?: string | null
          next_contact_date?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          segment_id?: string | null
          source?: string
          source_external_id?: string | null
          source_provider?: string | null
          source_region?: string | null
          source_searched_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_id?: string | null
          street_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name?: string | null
          next_contact_date?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          postal_code?: string | null
          segment_id?: string | null
          source?: string
          source_external_id?: string | null
          source_provider?: string | null
          source_region?: string | null
          source_searched_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_id?: string | null
          street_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_street_id_fkey"
            columns: ["street_id"]
            isOneToOne: false
            referencedRelation: "streets"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      neighborhoods: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
          state: string
          updated_at: string
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          name: string
          state?: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products_services: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          default_price: number | null
          description: string | null
          id: string
          kind: string
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          kind?: string
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          can_delete_documents: boolean
          can_view_all_leads: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          full_name: string
          id: string
          job_role_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          can_delete_documents?: boolean
          can_view_all_leads?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id: string
          job_role_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          can_delete_documents?: boolean
          can_view_all_leads?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          job_role_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          options: Json
          required: boolean
          segment_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          label: string
          options?: Json
          required?: boolean
          segment_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json
          required?: boolean
          segment_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "segment_fields_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_products: {
        Row: {
          product_id: string
          segment_id: string
        }
        Insert: {
          product_id: string
          segment_id: string
        }
        Update: {
          product_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_products_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      streets: {
        Row: {
          city: string
          created_at: string
          id: string
          name: string
          neighborhood_id: string | null
          state: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          name: string
          neighborhood_id?: string | null
          state?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          name?: string
          neighborhood_id?: string | null
          state?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streets_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_admin_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          reason: string | null
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          avg_consumption: number
          created_at: string
          created_by: string
          description: string
          fuel_price: number
          fuel_type: string
          id: string
          plate: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avg_consumption?: number
          created_at?: string
          created_by?: string
          description: string
          fuel_price?: number
          fuel_type?: string
          id?: string
          plate?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avg_consumption?: number
          created_at?: string
          created_by?: string
          description?: string
          fuel_price?: number
          fuel_type?: string
          id?: string
          plate?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      visit_route_stops: {
        Row: {
          actual_travel_minutes: number | null
          actual_visit_minutes: number | null
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          lead_id: string
          longitude: number | null
          notes: string | null
          planned_time: string | null
          planned_travel_minutes: number | null
          planned_visit_minutes: number
          priority: number
          route_id: string
          sort_order: number
          status: Database["public"]["Enums"]["route_stop_status"]
          updated_at: string
        }
        Insert: {
          actual_travel_minutes?: number | null
          actual_visit_minutes?: number | null
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          lead_id: string
          longitude?: number | null
          notes?: string | null
          planned_time?: string | null
          planned_travel_minutes?: number | null
          planned_visit_minutes?: number
          priority?: number
          route_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["route_stop_status"]
          updated_at?: string
        }
        Update: {
          actual_travel_minutes?: number | null
          actual_visit_minutes?: number | null
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          lead_id?: string
          longitude?: number | null
          notes?: string | null
          planned_time?: string | null
          planned_travel_minutes?: number | null
          planned_visit_minutes?: number
          priority?: number
          route_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["route_stop_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_route_stops_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "visit_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_routes: {
        Row: {
          actual_cost: number | null
          actual_distance_km: number | null
          actual_duration_minutes: number | null
          available_minutes: number | null
          city: string | null
          created_at: string
          created_by: string
          departure_time: string | null
          end_address: string | null
          end_label: string | null
          end_latitude: number | null
          end_longitude: number | null
          estimated_cost: number | null
          finished_at: string | null
          id: string
          notes: string | null
          owner_id: string
          planned_distance_km: number | null
          planned_duration_minutes: number | null
          region: string | null
          route_date: string
          segment_id: string | null
          start_address: string | null
          start_label: string | null
          start_latitude: number | null
          start_longitude: number | null
          started_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["route_status"]
          title: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          available_minutes?: number | null
          city?: string | null
          created_at?: string
          created_by?: string
          departure_time?: string | null
          end_address?: string | null
          end_label?: string | null
          end_latitude?: number | null
          end_longitude?: number | null
          estimated_cost?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          planned_distance_km?: number | null
          planned_duration_minutes?: number | null
          region?: string | null
          route_date: string
          segment_id?: string | null
          start_address?: string | null
          start_label?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          title?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          actual_distance_km?: number | null
          actual_duration_minutes?: number | null
          available_minutes?: number | null
          city?: string | null
          created_at?: string
          created_by?: string
          departure_time?: string | null
          end_address?: string | null
          end_label?: string | null
          end_latitude?: number | null
          end_longitude?: number | null
          estimated_cost?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          planned_distance_km?: number | null
          planned_duration_minutes?: number | null
          region?: string | null
          route_date?: string
          segment_id?: string | null
          start_address?: string | null
          start_label?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["route_status"]
          title?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_routes_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_document: { Args: { _document_id: string }; Returns: boolean }
      can_access_lead: { Args: { _lead_id: string }; Returns: boolean }
      can_access_route: { Args: { _route_id: string }; Returns: boolean }
      can_delete_documents: { Args: { _user_id: string }; Returns: boolean }
      can_edit_lead: { Args: { _lead_id: string }; Returns: boolean }
      can_view_all_leads: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_document_number: {
        Args: {
          _doc_type: Database["public"]["Enums"]["commercial_doc_type"]
          _doc_year?: number
        }
        Returns: {
          doc_number: number
          doc_year: number
          number_label: string
        }[]
      }
      recalc_document_totals: {
        Args: { _document_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "captador"
      appointment_status:
        | "agendado"
        | "realizado"
        | "nao_realizado"
        | "cancelado"
      commercial_doc_type: "orcamento" | "proposta" | "pedido"
      lead_status:
        | "novo"
        | "em_contato"
        | "contatado"
        | "interessado"
        | "proposta_enviada"
        | "negociacao"
        | "convertido"
        | "perdido"
      route_status: "planejado" | "em_andamento" | "concluido" | "cancelado"
      route_stop_status:
        | "pendente"
        | "em_deslocamento"
        | "em_visita"
        | "visitado"
        | "nao_visitado"
        | "reagendado"
        | "cancelado"
      visit_result:
        | "responsavel_ausente"
        | "contato_realizado"
        | "sem_interesse"
        | "interessado"
        | "demonstracao"
        | "proposta"
        | "follow_up"
        | "venda"
        | "nao_informado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "captador"],
      appointment_status: [
        "agendado",
        "realizado",
        "nao_realizado",
        "cancelado",
      ],
      commercial_doc_type: ["orcamento", "proposta", "pedido"],
      lead_status: [
        "novo",
        "em_contato",
        "contatado",
        "interessado",
        "proposta_enviada",
        "negociacao",
        "convertido",
        "perdido",
      ],
      route_status: ["planejado", "em_andamento", "concluido", "cancelado"],
      route_stop_status: [
        "pendente",
        "em_deslocamento",
        "em_visita",
        "visitado",
        "nao_visitado",
        "reagendado",
        "cancelado",
      ],
      visit_result: [
        "responsavel_ausente",
        "contato_realizado",
        "sem_interesse",
        "interessado",
        "demonstracao",
        "proposta",
        "follow_up",
        "venda",
        "nao_informado",
      ],
    },
  },
} as const
