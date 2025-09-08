--use MuhammadSharjeelFarzadDB;
use sharjeel_6609;
-- inserting values into the table named visit types
Insert into visitTypes
values (1,'Follow-Up'),(2,'Emergency'),(3,'Consultation');
go
select * from visitTypes;
go

-- inserting values ino the logger table;
insert into loggers values (1,'Admin'),(2,'Receptionist');
go 
select * from loggers;

-- inserting values into fee schedule table
insert into feeSchedule values (1,'Follow-Up',300),(2,'Emergency',1000),(3,'Consultation',500);
select * from feeSchedule;


-- inserting values into the visits table
INSERT INTO Visits (
    visitID, visitType, VisittypeID, visitDuration, visitDate, visitTime, visitFee
) VALUES
(1,  'Consultation', 3, 30, '2025-08-09', '10:30:00', NULL),
(2,  'Follow-up', 1, 20, '2025-08-09', '11:15:00', NULL),
(3, 'Emergency', 2, 60, '2025-08-09', '12:00:00', NULL);


-- show the visits table
select * from visits
-- to delete the visits from the table run this query
delete from visits;
-- generating random values in the visits table
declare @counter int =1;
While @counter<=20
begin
insert into Visits (visitID, visitType, VisittypeID, visitDuration, visitDate, visitTime, visitFee)
values (@counter,
case 
when @counter%3=1 then 'Follow-Up'
when @counter%3=2 then 'Emergency'
Else 'Consultation'
end,
case 
when @counter%3=1 then 1
when @counter%3=2 then 2
Else 3
end,
15+(@counter%46),
DateAdd(Day,-(@counter%365),GetDate()),
DateAdd(Minute,((@counter*7)%1440),'00:00'),
Null
)
set @counter=@counter+1
end;

-- setting thee visit fee column in the table
update visits
set visits.visitFee=feeSchedule.feePerMinute*visits.visitDuration
from visits join feeSchedule on visits.visitTypeID=feeSchedule.feeID



select visits.visitDuration,feeSchedule.VisitType 
from visits join feeSchedule on visits.visitTypeID=feeSchedule.feeID;

-- adding 20 patient data values in the patient table
delete from patients
INSERT INTO patients (
    patientID, visitID, patientName, patientEmail, patientPhone, patientDescription
) VALUES
(1, 7, 'Michael Davis', 'michael.davis1@example.com', '555-0001', 'Description for Michael Davis'),
(2, 15, 'Sophia Brown', 'sophia.brown2@example.com', '555-0002', 'Description for Sophia Brown'),
(3, 3, 'Daniel Smith', 'daniel.smith3@example.com', '555-0003', 'Description for Daniel Smith'),
(4, 12, 'Aisha Khan', 'aisha.khan4@example.com', '555-0004', 'Description for Aisha Khan'),
(5, 19, 'Hiro Tanaka', 'hiro.tanaka5@example.com', '555-0005', 'Description for Hiro Tanaka'),
(6, 5, 'Liam O’Connor', 'liam.oconnor6@example.com', '555-0006', 'Description for Liam O’Connor'),
(7, 18, 'Fatima Zahra', 'fatima.zahra7@example.com', '555-0007', 'Description for Fatima Zahra'),
(8, 1, 'Carlos Mendez', 'carlos.mendez8@example.com', '555-0008', 'Description for Carlos Mendez'),
(9, 14, 'Elena Petrova', 'elena.petrova9@example.com', '555-0009', 'Description for Elena Petrova'),
(10, 10, 'Rajesh Gupta', 'rajesh.gupta10@example.com', '555-0010', 'Description for Rajesh Gupta'),
(11, 8, 'Michael Davis', 'michael.davis1@example.com', '555-0011', 'Duplicate entry for Michael Davis'),
(12, 20, 'Sophia Brown', 'sophia.brown2@example.com', '555-0012', 'Duplicate entry for Sophia Brown'),
(13, 4, 'Julia Schneider', 'julia.schneider13@example.com', '555-0013', 'Description for Julia Schneider'),
(14, 16, 'Pedro Alvarez', 'pedro.alvarez14@example.com', '555-0014', 'Description for Pedro Alvarez'),
(15, 9, 'Amara Okafor', 'amara.okafor15@example.com', '555-0015', 'Description for Amara Okafor'),
(16, 11, 'Chen Wei', 'chen.wei16@example.com', '555-0016', 'Description for Chen Wei'),
(17, 6, 'Liam O’Connor', 'liam.oconnor6@example.com', '555-0017', 'Duplicate entry for Liam O’Connor'),
(18, 2, 'Omar Farouk', 'omar.farouk18@example.com', '555-0018', 'Description for Omar Farouk'),
(19, 17, 'Lucas Silva', 'lucas.silva19@example.com', '555-0019', 'Description for Lucas Silva'),
(20, 13, 'Sophia Brown', 'sophia.brown2@example.com', '555-0020', 'Second duplicate for Sophia Brown');



select * from patients

-- adding doctor data into the tables 
delete from doctors
INSERT INTO doctors (
    doctorID, visitID, doctorName, doctorEmail, doctorPhone, specialization
) VALUES
(1, 12, 'Dr. Emily Carter', 'emily.carter@example.com', '555-1001', 'Cardiology'),
(2, 5, 'Dr. James Wilson', 'james.wilson@example.com', '555-1002', 'Neurology'),
(3, 17, 'Dr. Ayesha Rahman', 'ayesha.rahman@example.com', '555-1003', 'Pediatrics'),
(4, 9, 'Dr. Marco Bianchi', 'marco.bianchi@example.com', '555-1004', 'Orthopedics'),
(5, 3, 'Dr. Sarah Thompson', 'sarah.thompson@example.com', '555-1005', 'Dermatology'),
(6, 20, 'Dr. Ahmed Farouk', 'ahmed.farouk@example.com', '555-1006', 'General Surgery'),
(7, 15, 'Dr. Laura Chen', 'laura.chen@example.com', '555-1007', 'Endocrinology'),
(8, 1, 'Dr. Peter Novak', 'peter.novak@example.com', '555-1008', 'Internal Medicine'),
(9, 8, 'Dr. Fatima Al-Mansoori', 'fatima.almansoori@example.com', '555-1009', 'Obstetrics & Gynecology'),
(10, 14, 'Dr. David Smith', 'david.smith@example.com', '555-1010', 'Psychiatry'),
(11, 2, 'Dr. Emily Carter', 'emily.carter@example.com', '555-1011', 'Duplicate entry for Cardiology'),
(12, 11, 'Dr. Laura Chen', 'laura.chen@example.com', '555-1012', 'Duplicate entry for Endocrinology'),
(13, 6, 'Dr. Thomas Müller', 'thomas.mueller@example.com', '555-1013', 'Pulmonology'),
(14, 18, 'Dr. Ahmed Farouk', 'ahmed.farouk@example.com', '555-1014', 'Duplicate entry for General Surgery'),
(15, 7, 'Dr. Brian Johnson', 'brian.johnson@example.com', '555-1015', 'Rheumatology'),
(16, 19, 'Dr. Peter Novak', 'peter.novak@example.com', '555-1016', 'Duplicate entry for Internal Medicine'),
(17, 16, 'Dr. Samuel Kim', 'samuel.kim@example.com', '555-1017', 'Oncology'),
(18, 10, 'Dr. Priya Mehta', 'priya.mehta@example.com', '555-1018', 'ENT Specialist'),
(19, 13, 'Dr. David Smith', 'david.smith@example.com', '555-1019', 'Duplicate entry for Psychiatry'),
(20, 4, 'Dr. James Wilson', 'james.wilson@example.com', '555-1020', 'Duplicate entry for Neurology');


select * from doctors

