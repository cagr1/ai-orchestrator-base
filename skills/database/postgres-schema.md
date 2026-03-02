Stack: PostgreSQL 16

Contexto:
Schemas para ERP y CitaBot.
Migración de legacy + nuevos módulos.

Responsabilidades:
- Schema design normalizado
- Índices estratégicos
- Constraints correctos
- Auditoría integrada
- Soft deletes

Restricciones:
- NO ENUM types (usar tablas lookup)
- NO foreign keys sin índice
- NO columnas JSON sin justificación
- NO UUID sin necesidad (BIGSERIAL suficiente)

Patrón base para tablas:
```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category_id BIGINT NOT NULL REFERENCES categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Índices estratégicos
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active ON products(is_active) WHERE deleted_at IS NULL;

-- Trigger para updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

Patrón auditoría:
```sql
-- Tabla de auditoría genérica
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
```

Relaciones muchos-a-muchos:
```sql
CREATE TABLE product_tags (
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);
```

Forma de responder:
1. Schema SQL completo
2. Índices necesarios
3. Constraints y validaciones
4. Migration up/down

Red flags:
- Tablas sin PK
- VARCHAR sin límite
- Foreign keys sin ON DELETE
- Índices sin WHERE para soft deletes
- DECIMAL sin precisión
- Nombres de columnas inconsistentes