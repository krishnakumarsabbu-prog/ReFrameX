       IDENTIFICATION DIVISION.
       PROGRAM-ID. BATCHCTL.
       AUTHOR. REFRAMEX-SAMPLE.
      * Batch control program with EXEC SQL, EXEC CICS, and DB2 calls.
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-SQLCODE          PIC S9(9) COMP.
       01  WS-EMP-ID           PIC 9(6).
       01  WS-EMP-NAME         PIC X(30).
       01  WS-TRANS-ID         PIC X(4) VALUE 'MENU'.
       PROCEDURE DIVISION.
       MAIN-PARA.
           PERFORM DB-READ
           PERFORM CICS-SEND
           PERFORM DB-UPDATE
           GO TO END-PROG.
       DB-READ.
           EXEC SQL
               SELECT EMP_ID, EMP_NAME
               INTO :WS-EMP-ID, :WS-EMP-NAME
               FROM EMPLOYEE
               WHERE EMP_ID = 100
           END-EXEC.
       CICS-SEND.
           EXEC CICS
               SEND MAP('EMP MAP')
               MAPSET('EMPMAP')
               FROM(WS-EMP-NAME)
           END-EXEC.
       DB-UPDATE.
           EXEC SQL
               UPDATE EMPLOYEE
               SET EMP_NAME = :WS-EMP-NAME
               WHERE EMP_ID = :WS-EMP-ID
           END-EXEC.
           EXEC CICS
               READ FILE('EMPFILE')
               INTO(WS-EMP-NAME)
           END-EXEC.
       END-PROG.
           STOP RUN.
