       IDENTIFICATION DIVISION.
       PROGRAM-ID. VALIDATE.
       AUTHOR. SYNTHETIC-FIXTURE.

      * SYNTHETIC fixture — validation subprogram called dynamically
      * by ACCTLEDG. Shared component across the complex fixture.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-VALID-FLAG      PIC X VALUE 'Y'.
       01  WS-MAX-AMT         PIC 9(9)V99 VALUE 9999999.99.

       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05  CA-TRANS-ID    PIC X(4).
           05  CA-ACCT-NUM    PIC 9(10).
           05  CA-AMOUNT      PIC 9(9)V99.

       PROCEDURE DIVISION USING DFHCOMMAREA.
       MAIN-PARA.
           IF CA-AMOUNT > WS-MAX-AMT
               MOVE 'N' TO WS-VALID-FLAG
               MOVE 'AMT' TO CA-TRANS-ID
           END-IF
           IF CA-ACCT-NUM = ZEROS
               MOVE 'N' TO WS-VALID-FLAG
               MOVE 'ACCT' TO CA-TRANS-ID
           END-IF
           GOBACK.
