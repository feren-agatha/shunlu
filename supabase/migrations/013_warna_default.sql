-- Warna default tenant baru mengikuti tema
alter table settings alter column warna_brand set default '#7A2BF0';
update settings set warna_brand = '#7A2BF0' where warna_brand = '#0F5C4D';
