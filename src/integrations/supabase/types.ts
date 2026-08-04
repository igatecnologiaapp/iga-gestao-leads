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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
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
      leads: {
        Row: {
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood_id: string | null
          neighborhood_name: string | null
          notes: string | null
          number: string | null
          phone: string | null
          segment_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          street_id: string | null
          street_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          segment_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_id?: string | null
          street_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          segment_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_id?: string | null
          street_name?: string | null
          updated_at?: string
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
      products_services: {
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
      profiles: {
        Row: {
          active: boolean
          can_view_all_leads: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          can_view_all_leads?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          can_view_all_leads?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_lead: { Args: { _lead_id: string }; Returns: boolean }
      can_view_all_leads: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "captador"
      lead_status:
        | "novo"
        | "em_contato"
        | "contatado"
        | "interessado"
        | "proposta_enviada"
        | "negociacao"
        | "convertido"
        | "perdido"
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
    },
  },
} as const
