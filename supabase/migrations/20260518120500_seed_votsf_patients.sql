-- Seeds real VOTSF patients from:
-- /Users/Fabio.Mota/Downloads/Base de dados de utentes da VOTSF.xlsx
--
-- Run supabase/queries/20260518120500_clear_existing_patients.sql first if the
-- current patient table only contains test data.

do $$
declare
target_organization_id uuid;
begin
select id
into target_organization_id
from public.organizations
order by id
    limit 1;

if target_organization_id is null then
    raise exception 'No organization found to seed patients.';
end if;

insert into public.locations (
    organization_id,
    name,
    color,
    active
)
select
    target_organization_id,
    location_seed.location_name,
    location_seed.color,
    true
from (
         values
             ('ERPI de São Domingos', 'S. Domingos', '#0f766e'),
             ('ERPI de Santo António', 'Sto António', '#2563eb'),
             ('ERPI de São Francisco', 'S. Francisco', '#7c3aed')
     ) as location_seed(sheet_name, location_name, color)
where not exists (
    select 1
    from public.locations location
    where location.organization_id = target_organization_id
      and location.name = location_seed.location_name
);

with patient_seed(location_name, name, birth_date, health_center, family_doctor, patient_number) as (
    values
        ('S. Domingos', 'Abel Sá Ferreira', '1946-03-14'::date, 'USF Santa Clara', 'Dra. Ana Costa', '177548840'),
        ('S. Domingos', 'Alberto Costa Pereira', '1940-01-27'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '173333953'),
        ('S. Domingos', 'Albina Lima Pereira', '1943-09-20'::date, 'USF Modivas', 'Dra. Raquel Souto', '173339268'),
        ('S. Domingos', 'Ana Costa Pereira', '1948-10-10'::date, 'USF Santa Clara', 'Dr. Nelson Ribeiro', '191365378'),
        ('S. Domingos', 'Ana Sobral Sousa', '1939-06-24'::date, 'USF Santa Clara', 'Dr. Flávio Guimarães', '198244471'),
        ('S. Domingos', 'Domingos Monteiro', '1950-09-02'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '167342359'),
        ('S. Domingos', 'Cândida Faria Pereira', '1934-12-04'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '171124469'),
        ('S. Domingos', 'Eduardo Fernando da Silva Fins', '1944-10-17'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '179602051'),
        ('S. Domingos', 'Elisa Rosas Gonçalves', '1942-02-01'::date, 'USF Santa Clara', 'Dra. Benedita Moura', '180709727'),
        ('S. Domingos', 'Ermelinda Correia Nogueira Sá', '1937-08-29'::date, 'USF Casa dos Pescadores', 'Dr. João Monteiro', '180663501'),
        ('S. Domingos', 'Fernando Jorge Aguiar', '1933-11-27'::date, 'USF Santa Clara', 'Dra. Benedita Moura', '177343591'),
        ('S. Domingos', 'João Faustino Alves Silva', '1931-01-25'::date, 'USF Aqueduto', 'Dra Marisa Pinheiro', '174984148'),
        ('S. Domingos', 'Joaquina Moreira Paiva', '1937-11-21'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '174705393'),
        ('S. Domingos', 'José Costa Araújo', '1936-12-27'::date, 'USF Modivas', 'Dr João Rocha', '168777603'),
        ('S. Domingos', 'José Maria Santos Reis', '1941-01-21'::date, 'EDP da Batalha', 'Dra. Glória Mendes', '164322411'),
        ('S. Domingos', 'Joaquim Fernando Teixeira Dias', '1956-05-15'::date, null, null, '166898822'),
        ('S. Domingos', 'Joaquim Pedrosa de Oliveira', '1950-09-06'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '163782929'),
        ('S. Domingos', 'José Avelino Granja', '1950-06-27'::date, 'USF Eça Queiros', 'Dra. Margarida Silva', '184545550'),
        ('S. Domingos', 'Judite Marques de Oliveira Moutinho', '1946-01-24'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '298085206'),
        ('S. Domingos', 'Laurinda Silva Azevedo', '1934-05-21'::date, 'Particular (GNR)', null, '166459993'),
        ('S. Domingos', 'Luís Caetano', '1922-06-13'::date, 'USF Santa Clara', 'Dr. Nelson Ribeiro', '198371437'),
        ('S. Domingos', 'Maria da Dores Pereira Marques', '1942-08-27'::date, 'USF Eça Queiros', 'Dr. Pedro Peixoto', '173396276'),
        ('S. Domingos', 'Manuel Mota', '1950-11-19'::date, 'USF Eiriz', 'Dra. Sandrine Dias', '185979842'),
        ('S. Domingos', 'Maria Alzira Moreira Costa Neves', '1938-09-06'::date, 'USF Aqueduto', 'Dra. Rosalina Magalhães', '175260373'),
        ('S. Domingos', 'Maria do Castelo', '1936-08-07'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '198186265'),
        ('S. Domingos', 'Maria Felismina Coelho Morais', '1937-12-18'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '170298594'),
        ('S. Domingos', 'Maria Lucília Magalhães Assunção', '1944-06-03'::date, 'EDP da Batalha', 'Dra. Glória Mendes', '197902850'),
        ('S. Domingos', 'Mª Rosa Moreira de Azevedo Reis', '1953-09-17'::date, 'USF Santo Amaro', 'Manuel Couto Tinoco', '178496273'),
        ('S. Domingos', 'Maria Rosa Sousa Vieira Santos', '1937-06-08'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '173868174'),
        ('S. Domingos', 'Zulmira Fernandes Moreira', '1944-07-17'::date, 'USF do mar', 'Dra. Ana Maia', '182309588'),
        ('Sto António', 'Aida Pedrosa Oliveira', '1937-06-04'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '197698078'),
        ('Sto António', 'Alberto Marinho Tavares', '1939-06-27'::date, 'USF Aqueduto', 'Dra. Joana Correia', '198034172'),
        ('Sto António', 'Albina Gonçalves Neto', '1931-08-26'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '188619358'),
        ('Sto António', 'Almerinda Dias Campos', '1943-03-14'::date, 'USF Aqueduto', 'Dra. Joana Correia', '197698545'),
        ('Sto António', 'Ana Vieira dos Santos', '1933-12-13'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '182667152'),
        ('Sto António', 'António Augusto Biague', '1958-06-30'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '161120693'),
        ('Sto António', 'Armandina de Jesus Lopes', '1941-05-22'::date, 'USF Aqueduto', 'Dra Elisa Ribeiro', '175031277'),
        ('Sto António', 'Carlos Silva Fernandes', '1935-05-26'::date, 'USF Santa Clara', 'Dra. Ana Dias Costa', '174848794'),
        ('Sto António', 'Duarte José Ferreira da Silva', '1961-08-04'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '168820851'),
        ('Sto António', 'Eduardo Ribeiro', '1937-06-15'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '169208422'),
        ('Sto António', 'Firmino Fernandes Dias', '1941-02-12'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '198263133'),
        ('Sto António', 'Isabel Dias Fonte Boa', '1938-12-25'::date, 'USF Casa dos Pescadores', 'Dra. Vera Pires', '189560952'),
        ('Sto António', 'Joaquim Nogueira da Cruz', '1936-08-29'::date, 'USF S. Simão da Junqueira', 'Dra. Ana Marques', '174562089'),
        ('Sto António', 'José Gomes Martins', '1948-04-25'::date, 'USF Navegantes', 'Dra. Liliana Moreira', '166925599'),
        ('Sto António', 'Manuel Fernando Simões', '1941-11-13'::date, 'USF Santa Clara', 'Dra. Ana Dias', '181838474'),
        ('Sto António', 'Maria Amélia Gil Lima Dias', '1939-07-08'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '167477837'),
        ('Sto António', 'Maria Bernardete Faria Mariz Pimenta Ribeiro', '1933-01-06'::date, 'USF Corino de Andrade', 'Dra. Mariana Moreira', '193093875'),
        ('Sto António', 'Maria Celestina Ferreira Monteiro', '1945-06-05'::date, 'USF Navegantes', 'Dra. Joana Ceu', '169985704'),
        ('Sto António', 'Maria Clotilde Leite', '1930-04-23'::date, 'USF Santa Clara', 'Dra. Ana Dias', '162320066'),
        ('Sto António', 'Maria Fernanda Rosa', '1938-12-21'::date, 'USF Aqueduto', 'Dra.Marisa Loio', '190600657'),
        ('Sto António', 'Maria Irene da Costa Moreira', '1945-10-17'::date, 'USF Casa dos Pescadores', 'Dra. Vera Pires', '161643697'),
        ('Sto António', 'Maria Isabel Sampaio Santos Barbosa', '1935-08-16'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '171545335'),
        ('Sto António', 'Maria Lurdes Silva Ferreira', '1939-04-09'::date, 'USF São Simão Junqueira', 'Dra. Ana Marques', '185371842'),
        ('Sto António', 'Maria Margarida Maio', '1958-01-16'::date, 'USF Santa Clara', 'Dra. Benedita Moura', '175206344'),
        ('Sto António', 'Maria Rosa Gomes Azevedo', '1938-08-13'::date, 'USF Navegantes', 'Drª Patrícia Silva', '176923000'),
        ('Sto António', 'Maria Rosa Gomes', '1916-07-30'::date, 'USF Santa Clara', 'Dra. Susana Cadilhe', '175423031'),
        ('Sto António', 'Maria Zulmira Cruz Monteiro', '1938-06-23'::date, 'USF Santa Clara', 'Dra. Ana Dias', '175753355'),
        ('Sto António', 'Miguel Jorge Castro Pinho', '1980-04-04'::date, null, null, '182523349'),
        ('Sto António', 'Georgina de Sousa Valente', '1940-11-11'::date, 'USF Odisseias Maia', 'Drª Cláudia', '175225239'),
        ('S. Francisco', 'Adalberto Óscar Pinto de Campos Moraes', '1935-01-25'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '176981259'),
        ('S. Francisco', 'Adelina Augusta de Azevedo Santos', '1947-01-07'::date, 'USF Aqueduto', 'Dra. Joana Rodrigues', '179094275'),
        ('S. Francisco', 'Adriana Durães Lopes', '1951-04-28'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '179635339'),
        ('S. Francisco', 'Agostinho Nunes Ribeiro', '1953-09-10'::date, 'USF Nova Lousada', 'Dra. Joana Barros', '173893954'),
        ('S. Francisco', 'Albertina Fernanda dos Santos Silva Oliveira', '1950-09-27'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '188910619'),
        ('S. Francisco', 'Albina Conceição Ramos da Costa', '1934-05-03'::date, 'USF Aqueduto', 'Dra. Elisa Ribeiro', '179977086'),
        ('S. Francisco', 'Ana Pereira da Silva', '1931-04-07'::date, 'USF Corino de Andrade', 'Dra. Mariana Brites', '191625752'),
        ('S. Francisco', 'António Azevedo Ramalho', '1958-07-27'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '197353812'),
        ('S. Francisco', 'António da Silva Melo', '1933-03-25'::date, 'USF Modivas', 'Dr. João Rocha', '173097963'),
        ('S. Francisco', 'António Maria F. Anjo', '1955-04-19'::date, 'USF Aqueduto', 'Dra. Carina Reis', '172190875'),
        ('S. Francisco', 'Conceição Maia Ferreira', '1943-06-30'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '173076069'),
        ('S. Francisco', 'Fernando Lopes Maia', '1942-07-26'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '167121641'),
        ('S. Francisco', 'Hermínia Azevedo Pereira', '1933-11-27'::date, 'USF Santa Clara', 'Dra. Marisa Pinheiro', '179936514'),
        ('S. Francisco', 'Isaura Maia Santos', '1933-07-09'::date, 'USF S. Simão da Junqueira', 'Dra. Ana Marques', '178283585'),
        ('S. Francisco', 'Jacinta Amélia Canto', '1944-01-05'::date, 'USF Aqueduto', 'Dra. Rosalina Magalhães', '185048764'),
        ('S. Francisco', 'João de Freitas Arantes', '1942-07-23'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '171539531'),
        ('S. Francisco', 'João Neves Ramos', '1945-01-12'::date, 'USF Santa Clara', 'Dr. Flávio Guimarães', '184266545'),
        ('S. Francisco', 'Joaquim Ferreira Dias Cruz', '1935-04-11'::date, 'USF Trofa', 'Dr. Francisco Costa', '173246198'),
        ('S. Francisco', 'José Maio Vieira', '1944-05-29'::date, 'USF Eça de Queirós', 'Dr. Pedro Monteiro', '172224046'),
        ('S. Francisco', 'José Manuel Rocha Marques', '1955-08-30'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '193085826'),
        ('S. Francisco', 'José dos Santos Silva', '1952-01-10'::date, 'USF Cruz de Malta', 'Dr. Diogo Costa', '198614816'),
        ('S. Francisco', 'Laura Eulalia Moreira da Cunha', '1931-03-09'::date, 'USF Aqueduto', 'Dra. Joana Correia', '197548574'),
        ('S. Francisco', 'Lucinda Costa e Silva', '1941-10-27'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '187751678'),
        ('S. Francisco', 'Luís Santos Ferreira', '1958-04-30'::date, 'USF Aqueduto', 'Dra.Marisa Loio', '176399016'),
        ('S. Francisco', 'Manuel Oliveira Ferreira', '1940-01-26'::date, 'USF Aqueduto', 'Dra.Carina Reis', '175423066'),
        ('S. Francisco', 'Manuel Novais Vale', '1940-09-01'::date, 'USF Santa Clara', 'Dr. Nelson Ribeiro', '167987730'),
        ('S. Francisco', 'Manuel Silva Cunha', '1945-08-03'::date, 'USF Santa Clara', 'Dra. Elisa Monte', '135276711'),
        ('S. Francisco', 'Maria Adelaide da Silva Braga', '1957-05-19'::date, 'USF Cruz de Malta', 'Dr. Diogo Costa', '198297894'),
        ('S. Francisco', 'Maria Adelaide Sousa Maia Carvalho', '1967-08-22'::date, 'USF Santa Clara', 'Dra. Patrícia Coelho', '179936985'),
        ('S. Francisco', 'Maria Adelaide Nunes Dores', '1940-05-14'::date, 'USF Aqueduto', 'Dra. Joana Rodrigues', '190073986'),
        ('S. Francisco', 'Maria Albertina Lopes', '1938-09-12'::date, 'USF Santo Amaro', 'Dr. Bruno Valentim', '173624457'),
        ('S. Francisco', 'Maria do Alívio Nunes Graça', '1949-11-21'::date, 'USF Navegantes', 'Dra. Inês Torres', '174651024'),
        ('S. Francisco', 'Maria Alzira Fernandes', '1957-01-03'::date, 'USF Aqueduto', 'Dra. Carina Reis', '182867042'),
        ('S. Francisco', 'Maria Amélia Flores', '1929-02-07'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '176490789'),
        ('S. Francisco', 'Maria Antonia Bacelar de Souza Machado', '1938-09-23'::date, 'USF Santa Clara', 'Dra. Benedita Moura', '165733167'),
        ('S. Francisco', 'Maria Cândida Lopes Costa', '1935-12-25'::date, 'USF Santa Clara', 'Dr. Flávio Guimarães', '174984252'),
        ('S. Francisco', 'Maria Carmo da Rocha Cerqueira', '1938-02-02'::date, 'USF Santa Clara', 'Dr. Diogo Costa', '184103941'),
        ('S. Francisco', 'Maria Conceição de Jesus Vieira', '1936-07-03'::date, 'USF Casa Pescadores', 'Dr. João Monteiro', '171901023'),
        ('S. Francisco', 'Maria de Fátima Martins Neves', '1935-07-08'::date, 'USF Eça de Queirós', 'Dra. Isabel Hora', '173940034'),
        ('S. Francisco', 'Maria Engrácia Leitão de Carvalho Bastos', '1939-02-15'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '175694224'),
        ('S. Francisco', 'Maria Fátima Souto das Neves da Silva', '1938-05-05'::date, 'USF Aqueduto', 'Dra. Joana Correia', '175110321'),
        ('S. Francisco', 'Maria Fernanda Peniche', '1939-05-16'::date, 'USF Santa Clara', 'Dra. Benedita Moura', '161145627'),
        ('S. Francisco', 'Maria Helena Neves', '1958-12-27'::date, 'USF Santa Clara', 'Dr. Flávio Guimarães', '198217349'),
        ('S. Francisco', 'Maria José Silva Leites', '1936-08-17'::date, 'USF Santa Clara', 'Dra. Susana Cadilhe', '179236943'),
        ('S. Francisco', 'Maria Lurdes Lima Ferraz Marques', '1949-09-16'::date, 'USF Godinho Faria', 'Dra Barbara Amorim', '168407204'),
        ('S. Francisco', 'Maria Lurdes Lopes Costa', '1932-10-22'::date, 'USF Aqueduto', 'Dra. Rosalina Magalhães', '174004444'),
        ('S. Francisco', 'Mª Mercedes Silva Laranjeira', '1944-01-02'::date, 'USF Aqueduto', 'Dra. Carina Reis', '178323221'),
        ('S. Francisco', 'Mª Rosa Barbosa dos Santos', '1937-02-28'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '180262465'),
        ('S. Francisco', 'Maria Rosa Costa', '1945-01-10'::date, 'USF Aqueduto', 'Dra. Carina Reis', '173417856'),
        ('S. Francisco', 'Maria Rosete Guerreiro da Palma', '1940-06-17'::date, 'USF Aqueduto', 'Dra. Joana Amorim', '171744193'),
        ('S. Francisco', 'Quitéria Cardoso da Rocha', '1938-05-31'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '182132827'),
        ('S. Francisco', 'Rosa Maria Sequeira Carvalhinho', '1944-09-12'::date, 'USF Santa Clara', 'Dr. Flávio Guimarães', '174651258'),
        ('S. Francisco', 'Rosa dos Santos Novo', '1944-06-22'::date, 'USF Navegantes', 'Dra. Vera Neves', '171453569'),
        ('S. Francisco', 'Sónia Cristina Almeida Neves', '1982-06-07'::date, 'USF Santa Clara', 'Dra. Daniela Maia', '177645232'),
        ('S. Francisco', 'Valentim de Oliveira Gomes Ferreira', '1934-12-27'::date, 'USF Corino de Andrade', 'Dr. Fernando Albano', '164656060'),
        ('S. Francisco', 'Válter Bernardino Soares', '1959-12-22'::date, 'USF Aqueduto', 'Dra. Marisa Loio', '168152552')
)
insert into public.patients (
    organization_id,
    location_id,
    name,
    birth_date,
    health_center,
    family_doctor,
    patient_number,
    notes,
    is_diabetic,
    is_hypertensive,
    has_active_wounds,
    active
  )
select
    target_organization_id,
    location.id,
    patient_seed.name,
    patient_seed.birth_date,
    patient_seed.health_center,
    patient_seed.family_doctor,
    patient_seed.patient_number,
    null,
    false,
    false,
    false,
    true
from patient_seed
         join public.locations location
              on location.organization_id = target_organization_id
                  and location.name = patient_seed.location_name
where not exists (
    select 1
    from public.patients patient
    where patient.organization_id = target_organization_id
      and (
        (
            patient_seed.patient_number is not null
                and patient.patient_number = patient_seed.patient_number
            )
            or (
            patient_seed.patient_number is null
                and patient.name = patient_seed.name
                and patient.location_id = location.id
            )
        )
);

with contact_seed(location_name, patient_name, patient_number, name, relationship, contact) as (
    values
        ('S. Domingos', 'Alberto Costa Pereira', '173333953', 'D. Mª Nascimento', 'Esposa', '969083534'),
        ('S. Domingos', 'Albina Lima Pereira', '173339268', 'D. Cátia Moreira', 'amiga', '939767927'),
        ('S. Domingos', 'Ana Costa Pereira', '191365378', 'Sr. Vitor Fernandes', 'Filho', '967370726'),
        ('S. Domingos', 'Ana Sobral Sousa', '198244471', 'Sr. Manuel Sobral', 'Filho', '966715514'),
        ('S. Domingos', 'Ana Sobral Sousa', '198244471', 'Nora', 'Nora', '963697120'),
        ('S. Domingos', 'Cândida Faria Pereira', '171124469', 'D. Palmira', 'Filha', '917572144'),
        ('S. Domingos', 'Eduardo Fernando da Silva Fins', '179602051', 'Sr. Vítor', 'Filho', '912737505'),
        ('S. Domingos', 'Elisa Rosas Gonçalves', '180709727', 'Sr. Fernando', 'enteado', '49597113235'),
        ('S. Domingos', 'Ermelinda Correia Nogueira Sá', '180663501', 'Sr. Ricardo Sá', 'filho', '914702595'),
        ('S. Domingos', 'Fernando Jorge Aguiar', '177343591', 'Sr. Fernando', 'enteado', '49597113235'),
        ('S. Domingos', 'João Faustino Alves Silva', '174984148', 'Sr José Alberto', 'filho', '916161794'),
        ('S. Domingos', 'Joaquina Moreira Paiva', '174705393', 'Sr. Fernando', 'sobrinho', '966717062'),
        ('S. Domingos', 'José Maria Santos Reis', '164322411', 'D. Maria Fátima', 'enteada', '919248803'),
        ('S. Domingos', 'José Maria Santos Reis', '164322411', 'Sr. Adriano', '"Genro"', '919248803'),
        ('S. Domingos', 'Joaquim Pedrosa de Oliveira', '163782929', 'D. Anabela', 'Amiga', '918804404'),
        ('S. Domingos', 'Joaquim Pedrosa de Oliveira', '163782929', 'D. Cláudia', 'Amiga', '913186622'),
        ('S. Domingos', 'José Avelino Granja', '184545550', 'D. Maria Granja', 'Filha', '918082968'),
        ('S. Domingos', 'Judite Marques de Oliveira Moutinho', '298085206', 'D. Susana Moreira', 'Filha', '966326992'),
        ('S. Domingos', 'Judite Marques de Oliveira Moutinho', '298085206', 'Cristina', 'Filha', '939505371'),
        ('S. Domingos', 'Laurinda Silva Azevedo', '166459993', 'D. Maria Alves', 'filha', '917010333'),
        ('S. Domingos', 'Luís Caetano', '198371437', 'Sr. Caetano', 'filho', '918736815'),
        ('S. Domingos', 'Maria da Dores Pereira Marques', '173396276', 'Elsa Graça', 'Neta', '912769910'),
        ('S. Domingos', 'Manuel Mota', '185979842', 'D. Helena', 'filha', '914625602'),
        ('S. Domingos', 'Maria Alzira Moreira Costa Neves', '175260373', 'Sr. Joaquim Neves', 'Filho', '912575897'),
        ('S. Domingos', 'Maria do Castelo', '198186265', 'Sr. António Coutinho', 'Filho', '963018101'),
        ('S. Domingos', 'Maria Felismina Coelho Morais', '170298594', 'Sr. Alberto Barbosa', 'Filho', '968064591'),
        ('S. Domingos', 'Maria Lucília Magalhães Assunção', '197902850', 'Sr. Renato Vidal', 'Filho', '917410238'),
        ('S. Domingos', 'Mª Rosa Moreira de Azevedo Reis', '178496273', 'Ana Reis', 'Nora', '914206238'),
        ('S. Domingos', 'Maria Rosa Sousa Vieira Santos', '173868174', 'D. Olga Araújo', 'Filha', '929249611'),
        ('S. Domingos', 'Maria Rosa Sousa Vieira Santos', '173868174', 'Sr. Ismael', 'Marido', '962331466'),
        ('S. Domingos', 'Zulmira Fernandes Moreira', '182309588', 'D. Cidália', 'sobrinha', '967830532'),
        ('Sto António', 'Aida Pedrosa Oliveira', '197698078', 'D. Isaura', 'filha', '966196156'),
        ('Sto António', 'Alberto Marinho Tavares', '198034172', 'D.lda Tavares', 'filha', '914508246'),
        ('Sto António', 'Alberto Marinho Tavares', '198034172', 'Ilídia Campos', 'Cunhada', '963226966'),
        ('Sto António', 'Almerinda Dias Campos', '197698545', 'D. Alda Tavares', 'filha', '914508246'),
        ('Sto António', 'Almerinda Dias Campos', '197698545', 'Ilídia Campos', 'irmã', '963226966'),
        ('Sto António', 'Ana Vieira dos Santos', '182667152', 'Sr. Fernando', 'irmão', '932737550'),
        ('Sto António', 'Ana Vieira dos Santos', '182667152', 'D. Liliana Santos', 'sobrinha', '932920211'),
        ('Sto António', 'Armandina de Jesus Lopes', '175031277', 'Alice Vaz', 'filha', '964561162'),
        ('Sto António', 'Carlos Silva Fernandes', '174848794', 'Sr. José Carlos', 'Sobrinho', '919565325'),
        ('Sto António', 'Duarte José Ferreira da Silva', '168820851', 'Sr. Pedro Silva', 'irmão', '962123005'),
        ('Sto António', 'Firmino Fernandes Dias', '198263133', 'D. Carla Soares', 'filha', '918798847'),
        ('Sto António', 'Isabel Dias Fonte Boa', '189560952', 'D. Carla', 'filha', '967293959'),
        ('Sto António', 'Isabel Dias Fonte Boa', '189560952', 'Sr. Manuel', 'filho', '968338525'),
        ('Sto António', 'Joaquim Nogueira da Cruz', '174562089', 'D. Maria Cruz', 'nora', '914532779'),
        ('Sto António', 'José Gomes Martins', '166925599', 'Elisabete Martins', 'filha', '962202601'),
        ('Sto António', 'Maria Amélia Gil Lima Dias', '167477837', 'Sr. Adolfo Lima', 'irmão', '919748190'),
        ('Sto António', 'Maria Amélia Gil Lima Dias', '167477837', 'Sr. Valter Dias', 'neto', '910452018'),
        ('Sto António', 'Maria Bernardete Faria Mariz Pimenta Ribeiro', '193093875', 'António José Ribeiro', 'Filho', '964017915'),
        ('Sto António', 'Maria Celestina Ferreira Monteiro', '169985704', 'D. Arminda Branco', 'filha', '967111742'),
        ('Sto António', 'Maria Celestina Ferreira Monteiro', '169985704', 'D. Maria da Guia', 'irmã', '918701188'),
        ('Sto António', 'Maria Clotilde Leite', '162320066', 'Sr. Alfredo', 'filho', '913496900'),
        ('Sto António', 'Maria Fernanda Rosa', '190600657', 'Sr. Jorge Pereira', 'marido', '913537080'),
        ('Sto António', 'Maria Irene da Costa Moreira', '161643697', 'D. Alice Lage', 'Mãe da Nora', '964853769'),
        ('Sto António', 'Maria Isabel Sampaio Santos Barbosa', '171545335', 'Sr. António Maria', 'filho', '933508415'),
        ('Sto António', 'Maria Isabel Sampaio Santos Barbosa', '171545335', 'D. Sandra', 'nora', '933910547'),
        ('Sto António', 'Maria Lurdes Silva Ferreira', '185371842', 'Sr. Virgílio', 'Filho', '918432498'),
        ('Sto António', 'Maria Margarida Maio', '175206344', 'D. Cláudia', 'filha', '933946882'),
        ('Sto António', 'Maria Rosa Gomes Azevedo', '176923000', 'Dª Deolinda Ribeiro', 'filha', '969272215'),
        ('Sto António', 'Maria Rosa Gomes', '175423031', 'D. Maria Emília', 'filha', '962485242'),
        ('Sto António', 'Maria Rosa Gomes', '175423031', 'Sr. Manuel', 'filho', '917492179'),
        ('Sto António', 'Miguel Jorge Castro Pinho', '182523349', 'D. Maria Castro', 'Tia', '938858521'),
        ('Sto António', 'Georgina de Sousa Valente', '175225239', 'Nuno Miguel de Lima', 'Sobrinho', '936875339'),
        ('Sto António', 'Georgina de Sousa Valente', '175225239', 'Cristina de Lima', 'Sobrinha', '919962563'),
        ('S. Francisco', 'Adalberto Óscar Pinto de Campos Moraes', '176981259', 'D. Cláudia Moraes Teixeira', 'filha', '916651871'),
        ('S. Francisco', 'Adelina Augusta de Azevedo Santos', '179094275', 'Sr. Carlos Campos', 'Filho', '936570296'),
        ('S. Francisco', 'Adelina Augusta de Azevedo Santos', '179094275', 'Sr. Joaquim', 'Filho', '918597788'),
        ('S. Francisco', 'Adriana Durães Lopes', '179635339', 'M. Conceição Neto', 'Irmã', '917091282'),
        ('S. Francisco', 'Agostinho Nunes Ribeiro', '173893954', 'Sr. Paulo Ribeiro', 'Filho', '963182024'),
        ('S. Francisco', 'Albertina Fernanda dos Santos Silva Oliveira', '188910619', 'Sr. Hélder Ferreira', 'filho', '938226605'),
        ('S. Francisco', 'Albertina Fernanda dos Santos Silva Oliveira', '188910619', 'D. Ana Ferreira', 'filha', '916540000'),
        ('S. Francisco', 'Albina Conceição Ramos da Costa', '179977086', 'Rosa Santos', 'Filha', '961051829'),
        ('S. Francisco', 'Ana Pereira da Silva', '191625752', 'Sr. José Carlos Ferreira', 'Genro', '965082557'),
        ('S. Francisco', 'Ana Pereira da Silva', '191625752', 'Sr. Daniel Moreira', 'Genro', '912599722'),
        ('S. Francisco', 'António Azevedo Ramalho', '197353812', 'D. Maria Conceição', 'irmã', '916641179'),
        ('S. Francisco', 'António Azevedo Ramalho', '197353812', 'D. Carmen Raquel', 'sobrinha', '914262662'),
        ('S. Francisco', 'António da Silva Melo', '173097963', 'Sr. José Melo', 'Filho', '939998529'),
        ('S. Francisco', 'António da Silva Melo', '173097963', 'Ana Duarte', 'filha', '966813936'),
        ('S. Francisco', 'António Maria F. Anjo', '172190875', 'Próprio', 'Próprio', '961906117'),
        ('S. Francisco', 'Conceição Maia Ferreira', '173076069', 'D. Daniela Susana', 'Nora', '913732919'),
        ('S. Francisco', 'Conceição Maia Ferreira', '173076069', 'D. Leonor Macedo', 'amiga', '961712047'),
        ('S. Francisco', 'Fernando Lopes Maia', '167121641', 'Dª Mª do Céu Maia', 'Filha', '924464908'),
        ('S. Francisco', 'Isaura Maia Santos', '178283585', 'Sr. Carlos', 'filho', '919318384'),
        ('S. Francisco', 'Jacinta Amélia Canto', '185048764', 'Sr. António Canto', 'filho', '914089205'),
        ('S. Francisco', 'João de Freitas Arantes', '171539531', 'D. Cristina Arantes', 'filha', '0031 682943056'),
        ('S. Francisco', 'João Neves Ramos', '184266545', 'Sr. Pinto', 'amigo', '918644089'),
        ('S. Francisco', 'Joaquim Ferreira Dias Cruz', '173246198', 'D. Cristina Maia Ferreira Cruz', 'filha', '963764991'),
        ('S. Francisco', 'Joaquim Ferreira Dias Cruz', '173246198', 'Manuel Cruz', 'filho', '969519428'),
        ('S. Francisco', 'José Maio Vieira', '172224046', 'D. Graça', 'Filha', '919055831'),
        ('S. Francisco', 'José Manuel Rocha Marques', '193085826', 'M. José Peixoto', 'Irmã', '913363071'),
        ('S. Francisco', 'José dos Santos Silva', '198614816', 'D. Monica Santos', 'filha', '965593209'),
        ('S. Francisco', 'Laura Eulalia Moreira da Cunha', '197548574', 'D. Olga Maria Simões', 'filha', '965150860'),
        ('S. Francisco', 'Laura Eulalia Moreira da Cunha', '197548574', 'D. Maria Alice Morim', 'filha', '917741865'),
        ('S. Francisco', 'Lucinda Costa e Silva', '187751678', 'D. Maria Clara', 'amiga', '937820832'),
        ('S. Francisco', 'Lucinda Costa e Silva', '187751678', 'D. Almerinda', 'prima', '914816942'),
        ('S. Francisco', 'Luís Santos Ferreira', '176399016', 'D. Margarida', 'irmã', '917155299'),
        ('S. Francisco', 'Luís Santos Ferreira', '176399016', 'D. Angela', 'sobrinha', '919150015'),
        ('S. Francisco', 'Manuel Oliveira Ferreira', '175423066', 'D. Alexandrina Silva', 'neta', '916871485'),
        ('S. Francisco', 'Manuel Oliveira Ferreira', '175423066', 'D. Isabel Silva', 'neta', '916870203'),
        ('S. Francisco', 'Manuel Novais Vale', '167987730', 'Sr. Alexandre Lopes', 'primo', '917058863'),
        ('S. Francisco', 'Manuel Novais Vale', '167987730', 'D. Isabel Vale', 'filha', '447456034271'),
        ('S. Francisco', 'Manuel Silva Cunha', '135276711', 'Sr. António Araújo', 'amigo', '916933881'),
        ('S. Francisco', 'Maria Adelaide da Silva Braga', '198297894', 'D. Monica Santos', 'filha', '965593209'),
        ('S. Francisco', 'Maria Adelaide Sousa Maia Carvalho', '179936985', 'D. Joaquina', 'cunhada', '912573576'),
        ('S. Francisco', 'Maria Adelaide Sousa Maia Carvalho', '179936985', 'D. Marta Maia', 'filha', '913355166'),
        ('S. Francisco', 'Maria Adelaide Nunes Dores', '190073986', 'Sr. Alfredo Dores', 'filho', '933256615'),
        ('S. Francisco', 'Maria Adelaide Nunes Dores', '190073986', 'Sr. Fernando Dores', 'filho', '939057895'),
        ('S. Francisco', 'Maria Albertina Lopes', '173624457', 'D. Mª Rosa Costa', 'filha', '916811540'),
        ('S. Francisco', 'Maria do Alívio Nunes Graça', '174651024', 'D. Maria Calobra', 'filha', '933260957'),
        ('S. Francisco', 'Maria Alzira Fernandes', '182867042', 'D. Cândida Martins', 'irmã', '918194540'),
        ('S. Francisco', 'Maria Alzira Fernandes', '182867042', 'D. Goreti Fernandes', 'irmã', '917117465'),
        ('S. Francisco', 'Maria Amélia Flores', '176490789', 'D. Anabela Flores', 'filha', '934393593'),
        ('S. Francisco', 'Maria Amélia Flores', '176490789', 'Mª Adelaide Flores', 'filha', '925106275'),
        ('S. Francisco', 'Maria Antonia Bacelar de Souza Machado', '165733167', 'Sr. Gonçalo Bettencourt', 'neto', '914329147'),
        ('S. Francisco', 'Maria Antonia Bacelar de Souza Machado', '165733167', 'Sr. Raimundo Bettencourt', 'filho', '911914653'),
        ('S. Francisco', 'Maria Cândida Lopes Costa', '174984252', 'Sr. Nuno Pacheco', 'Sobrinho', '965883047'),
        ('S. Francisco', 'Maria Cândida Lopes Costa', '174984252', 'Sr. Rui Pacheco', 'Sobrinho', '917614781'),
        ('S. Francisco', 'Maria Carmo da Rocha Cerqueira', '184103941', 'Sr. José Cerqueira', 'filho', '919148837'),
        ('S. Francisco', 'Maria Carmo da Rocha Cerqueira', '184103941', 'D. Florinda', 'nora', '912614715'),
        ('S. Francisco', 'Maria Conceição de Jesus Vieira', '171901023', 'D. Isabel Cristina', 'Nora', '914907517'),
        ('S. Francisco', 'Maria de Fátima Martins Neves', '173940034', 'Sr. Aparício Freitas', 'Sobrinho', '915225388'),
        ('S. Francisco', 'Maria Engrácia Leitão de Carvalho Bastos', '175694224', 'D. Ana Paula Bastos', 'Filha', '916278753'),
        ('S. Francisco', 'Maria Fátima Souto das Neves da Silva', '175110321', 'D. Amélia Silva', 'filha', '933267413'),
        ('S. Francisco', 'Maria Fernanda Peniche', '161145627', 'D. Antónia Peniche (Tonica)', 'sobrinha', '918716402'),
        ('S. Francisco', 'Maria Helena Neves', '198217349', 'D. Maria José', 'cunhada', '966628686'),
        ('S. Francisco', 'Maria José Silva Leites', '179236943', 'Sr. Nélson', 'Filho', '917443065'),
        ('S. Francisco', 'Maria José Silva Leites', '179236943', 'Sr. Rui', 'filho', '967322547'),
        ('S. Francisco', 'Maria Lurdes Lima Ferraz Marques', '168407204', 'Sr. Francisco Marques', 'Marido', '934809326'),
        ('S. Francisco', 'Maria Lurdes Lopes Costa', '174004444', 'Sr. Nuno Pacheco', 'Sobrinho', '965883047'),
        ('S. Francisco', 'Maria Lurdes Lopes Costa', '174004444', 'Sr. Rui Pacheco', 'Sobrinho', '917614781'),
        ('S. Francisco', 'Mª Mercedes Silva Laranjeira', '178323221', 'Mª Madalena Torres', 'irma', '934359703'),
        ('S. Francisco', 'Mª Rosa Barbosa dos Santos', '180262465', 'Alberto Ferreira', 'filho', '936293175'),
        ('S. Francisco', 'Mª Rosa Barbosa dos Santos', '180262465', 'Manuel Ferreira', 'filho', '926325107'),
        ('S. Francisco', 'Maria Rosete Guerreiro da Palma', '171744193', 'D. Tânia Fonseca', 'filha', '915593000'),
        ('S. Francisco', 'Quitéria Cardoso da Rocha', '182132827', 'Sr. Joaquim', 'Filho', '918607092'),
        ('S. Francisco', 'Rosa Maria Sequeira Carvalhinho', '174651258', 'D. Carla Mendes', 'Filha', '935101875'),
        ('S. Francisco', 'Rosa dos Santos Novo', '171453569', 'D. Lúcia André', 'filha', '911179707'),
        ('S. Francisco', 'Valentim de Oliveira Gomes Ferreira', '164656060', 'Alberto Ferreira', 'filho', '936293175'),
        ('S. Francisco', 'Valentim de Oliveira Gomes Ferreira', '164656060', 'Manuel Ferreira', 'filho', '926325107'),
        ('S. Francisco', 'Válter Bernardino Soares', '168152552', 'D. Teresa Soares', 'irmã', '965568905'),
        ('S. Francisco', 'Válter Bernardino Soares', '168152552', 'D. Cristina Soares', 'irmã', '913520864')
)
insert into public.patient_family_contacts (
    organization_id,
    patient_id,
    name,
    relationship,
    contact
  )
select
    target_organization_id,
    patient.id,
    contact_seed.name,
    contact_seed.relationship,
    contact_seed.contact
from contact_seed
         join public.locations location
              on location.organization_id = target_organization_id
                  and location.name = contact_seed.location_name
         join public.patients patient
              on patient.organization_id = target_organization_id
                  and patient.location_id = location.id
                  and (
                     (
                         contact_seed.patient_number is not null
                             and patient.patient_number = contact_seed.patient_number
                         )
                         or (
                         contact_seed.patient_number is null
                             and patient.name = contact_seed.patient_name
                         )
                     )
where not exists (
    select 1
    from public.patient_family_contacts family_contact
    where family_contact.organization_id = target_organization_id
      and family_contact.patient_id = patient.id
      and family_contact.name = contact_seed.name
      and family_contact.relationship = contact_seed.relationship
      and family_contact.contact = contact_seed.contact
);
end;
$$;
