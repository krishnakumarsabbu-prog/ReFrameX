       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYCALC.
       AUTHOR. SYNTHETIC-FIXTURE.

      * SYNTHETIC fixture — not a real Wells Fargo application.
      * Straightforward payroll calculation program.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT PAY-FILE    ASSIGN TO PAYFILE
               ORGANIZATION IS SEQUENTIAL.
           SELECT PAY-OUT     ASSIGN TO PAYOUT
               ORGANIZATION IS SEQUENTIAL.

       DATA DIVISION.
       FILE SECTION.
       FD  PAY-FILE
           RECORDING MODE IS F
           RECORD CONTAINS 80 CHARACTERS.
       01  PAY-REC.
           05  EMP-ID          PIC 9(6).
           05  EMP-HOURS       PIC 9(5)V99.
           05  EMP-RATE        PIC 9(5)V99.

       FD  PAY-OUT
           RECORDING MODE IS F
           RECORD CONTAINS 120 CHARACTERS.
       01  PAY-OUT-REC.
           05  OUT-ID          PIC 9(6).
           05  OUT-GROSS       PIC 9(7)V99.
           05  OUT-NET         PIC 9(7)V99.

       WORKING-STORAGE SECTION.
       01  WS-EOF              PIC X VALUE 'N'.
       01  WS-GROSS            PIC 9(7)V99 VALUE ZERO.
       01  WS-NET              PIC 9(7)V99 VALUE ZERO.
       01  WS-TAX-RATE         PIC 9V99 VALUE 0.25.

       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT PAY-FILE
           OPEN OUTPUT PAY-OUT
           PERFORM UNTIL WS-EOF = 'Y'
               READ PAY-FILE
                   AT END
                       MOVE 'Y' TO WS-EOF
                   NOT AT END
                       COMPUTE WS-GROSS = EMP-HOURS * EMP-RATE
                       COMPUTE WS-NET = WS-GROSS - (WS-GROSS * WS-TAX-RATE)
                       MOVE EMP-ID TO OUT-ID
                       MOVE WS-GROSS TO OUT-GROSS
                       MOVE WS-NET TO OUT-NET
                       WRITE PAY-OUT-REC
               END-READ
           END-PERFORM
           CLOSE PAY-FILE
           CLOSE PAY-OUT
           STOP RUN.
