CREATE TABLE empleado (
  id_empleado INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  cargo VARCHAR(50)
);

CREATE TABLE tecnico (
  id_tecnico INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_empleado INT NOT NULL,
  FOREIGN KEY (id_empleado) REFERENCES empleado(id_empleado)
);

CREATE TABLE cliente (
  id_cliente INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_tecnico INT,
  nombre VARCHAR(100) NOT NULL,
  dni VARCHAR(8) UNIQUE,
  celular VARCHAR(9),
  FOREIGN KEY (id_tecnico) REFERENCES tecnico(id_tecnico)
);

CREATE TABLE servicio (
  id_servicio INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente INT NOT NULL,
  monto DECIMAL(10,2),
  fecha_servicio DATE,
  FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);
