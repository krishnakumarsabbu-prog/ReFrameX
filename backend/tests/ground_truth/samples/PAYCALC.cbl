       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYCALC.
       AUTHOR. REFRAMEX-SAMPLE.
      * Sample payroll calculation program with tricky cases.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT PAYROLL-FILE ASSIGN TO PAYFILE
               ORGANIZATION IS SEQUENTIAL.
           SELECT REPORT-FILE  ASSIGN TO RPTFILE
               ORGANIZATION IS SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  PAYROLL-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 80 CHARACTERS.
       01  PAYROLL-REC.
           05  EMP-ID          PIC 9(6).
           05  EMP-NAME        PIC X(20).
           05  EMP-SALARY      PIC 9(7)V99.
       FD  REPORT-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 120 CHARACTERS.
       WORKING-STORAGE SECTION.
       01  WS-EOF              PIC X VALUE 'N'.
       01  WS-CALL-TARGET      PIC X(8) VALUE 'SUBPROG'.
       01  WS-PAY-STRUCT.
           05  WS-PAY-AMT      PIC 9(7)V99.
           05  WS-PAY-DATE     PIC 9(8).
           05  WS-PAY-FLAG     PIC X(1).
               88  WS-PAY-OK   VALUE 'Y'.
               88  WS-PAY-ERR  VALUE 'N'.
       01  WS-REDEF-AREA.
           05  WS-RED-NUM      PIC 9(5).
           05  FILLER          PIC X(15).
       01  WS-RED-ALPHA REDEFINES WS-REDEF-AREA.
           05  WS-RED-STR      PIC X(20).
       01  WS-TABLE.
           05  WS-TAB-ITEM     PIC 9(4) COMP OCCURS 10.
       01  WS-PACKED           PIC 9(7)V99 COMP-3.
       PROCEDURE DIVISION.
       MAIN-PARA.
           CALL 'CALCTAX' USING WS-PAY-AMT
           CALL WS-CALL-TARGET
           PERFORM READ-RECORDS
           PERFORM CALC-PAY
           PERFORM WRITE-REPORT
      *    CALL 'OLDPROG' USING WS-EOF
           STOP RUN.
       READ-RECORDS.
           OPEN INPUT PAYROLL-FILE
           PERFORM UNTIL WS-EOF = 'Y'
               READ PAYROLL-FILE
                   AT END
                       MOVE 'Y' TO WS-EOF
                   NOT AT END
                       ADD EMP-SALARY TO WS-PAY-AMT
               END-READ
           END-PERFORM
           CLOSE PAYROLL-FILE.
       CALC-PAY.
           COMPUTE WS-PAY-AMT = WS-PAY-AMT * 1.05
           IF WS-PAY-AMT > 5000
               DISPLAY 'CALL ADMIN FOR APPROVAL'
           END-IF.
       WRITE-REPORT.
           OPEN OUTPUT REPORT-FILE
           DISPLAY 'WRITING REPORT FOR ' EMP-NAME
           CLOSE REPORT-FILE.
